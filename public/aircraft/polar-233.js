/**
 * SGS 2-33 polar + MacCready tangent construction (browser).
 * Chart: IAS in mph (X), vertical speed in knots (Y, + climb / − sink).
 * Polar is fixed in airspeed — wind does not shift the curve.
 * MacCready ring setting is in knots (same as vertical speed).
 * Wind: positive = tailwind mph, negative = headwind mph.
 * Tangent pivot on X: headwind → +|wind|, tailwind → −|wind|, calm → 0
 * (with MC on Y). Touch point’s X is optimum IAS.
 */
(function (global) {
  const KT_TO_MPH = 1.1507794;
  const MPH_TO_KT = 1 / KT_TO_MPH;
  const MPH_TO_FPS = 5280 / 3600;
  const KT_TO_FPS = 6076.12 / 3600;

  /**
   * POH sink-vs-IAS anchors (mph, sink ft/sec) from the original performance graph.
   * L/D is derived as V(fps)/sink(fps). Chart Y uses knots (sink_fps / KT_TO_FPS).
   */
  const SINK_TABLES = {
    solo: {
      label: 'Solo',
      weight_lb: 790,
      wing_loading_psf: 3.6,
      stall_mph: 34,
      // [IAS mph, sink ft/sec]
      sink_fps_mph: [
        [34, 3.0],
        [36, 2.9],
        [42, 2.95],
        [48, 3.6],
        [54, 4.25],
        [60, 5.25],
        [66, 6.0],
        [72, 7.25]
      ]
    },
    dual: {
      label: 'Dual',
      weight_lb: 1040,
      wing_loading_psf: 4.74,
      stall_mph: 38,
      sink_fps_mph: [
        [38, 3.5],
        [42, 3.35],
        [48, 3.4],
        [54, 3.75],
        [60, 4.25],
        [66, 5.0],
        [72, 6.0],
        [78, 7.5],
        [84, 9.0],
        [87, 10.0]
      ]
    }
  };

  function lerp(a, b, t) {
    return a + (b - a) * t;
  }

  function catmullRom(p0, p1, p2, p3, t) {
    const t2 = t * t;
    const t3 = t2 * t;
    return (
      0.5 *
      (2 * p1 +
        (-p0 + p2) * t +
        (2 * p0 - 5 * p1 + 4 * p2 - p3) * t2 +
        (-p0 + 3 * p1 - 3 * p2 + p3) * t3)
    );
  }

  function sinkTableToAnchors(sinkFpsMph) {
    return sinkFpsMph.map(([mph, sinkFps]) => {
      const ias_kt = mph * MPH_TO_KT;
      const sink_fps = Number(sinkFps);
      const vs_kt = -(sink_fps / KT_TO_FPS);
      const vFps = mph * MPH_TO_FPS;
      const ld = vFps / Math.max(1e-6, sink_fps);
      return { ias_kt, vs_kt, mph, ld, sink_fps };
    });
  }

  /**
   * Continuous polar sample via Catmull–Rom on sink vs IAS (exact at POH anchors).
   * Smooth curve so MacCready touch IAS moves continuously with MC/wind.
   */
  function samplePolarAtMph(anchors, mph) {
    const pts = anchors;
    const n = pts.length;
    if (n === 0) return null;
    if (mph <= pts[0].mph) {
      return { ...pts[0] };
    }
    if (mph >= pts[n - 1].mph) {
      return { ...pts[n - 1] };
    }
    let i = 0;
    while (i < n - 2 && pts[i + 1].mph < mph) i += 1;
    const p0 = pts[Math.max(0, i - 1)];
    const p1 = pts[i];
    const p2 = pts[i + 1];
    const p3 = pts[Math.min(n - 1, i + 2)];
    const span = p2.mph - p1.mph;
    const t = span > 0 ? (mph - p1.mph) / span : 0;
    // Interpolate sink_fps (positive) then convert — keeps POH units stable.
    const sink_fps = Math.max(
      0.05,
      catmullRom(p0.sink_fps, p1.sink_fps, p2.sink_fps, p3.sink_fps, t)
    );
    const vs = -(sink_fps / KT_TO_FPS);
    const ias = mph * MPH_TO_KT;
    const vFps = mph * MPH_TO_FPS;
    const ld = vFps / Math.max(1e-6, sink_fps);
    return { mph, ias_kt: ias, vs_kt: vs, ld, sink_fps };
  }

  /** Dense display path (~0.05 mph) from the continuous polar. */
  function buildSmoothPolar(anchors, stepMph = 0.05) {
    const out = [];
    const lo = anchors[0].mph;
    const hi = anchors[anchors.length - 1].mph;
    for (let mph = lo; mph <= hi + 1e-9; mph += stepMph) {
      out.push(samplePolarAtMph(anchors, mph));
    }
    const last = anchors[anchors.length - 1];
    if (!out.length || Math.abs(out[out.length - 1].mph - last.mph) > 1e-6) {
      out.push({ ...last });
    }
    return out;
  }

  /** Golden-section maximize f on [lo, hi] (unimodal). */
  function maximizeUnimodal(f, lo, hi, iters = 48) {
    const resphi = 2 - (1 + Math.sqrt(5)) / 2;
    let a = lo;
    let b = hi;
    let c = a + resphi * (b - a);
    let d = b - resphi * (b - a);
    let fc = f(c);
    let fd = f(d);
    for (let i = 0; i < iters; i += 1) {
      if (fc > fd) {
        b = d;
        d = c;
        fd = fc;
        c = a + resphi * (b - a);
        fc = f(c);
      } else {
        a = c;
        c = d;
        fc = fd;
        d = b - resphi * (b - a);
        fd = f(d);
      }
    }
    return fc > fd ? c : d;
  }

  /** Catmull–Rom → cubic Bezier segments for SVG path (visually smooth). */
  function polarToBezierPath(points, mapX, mapY) {
    if (!points.length) return '';
    if (points.length === 1) {
      return `M ${mapX(points[0]).toFixed(2)} ${mapY(points[0]).toFixed(2)}`;
    }
    let d = `M ${mapX(points[0]).toFixed(2)} ${mapY(points[0]).toFixed(2)}`;
    for (let i = 0; i < points.length - 1; i += 1) {
      const p0 = points[Math.max(0, i - 1)];
      const p1 = points[i];
      const p2 = points[i + 1];
      const p3 = points[Math.min(points.length - 1, i + 2)];
      const c1x = mapX(p1) + (mapX(p2) - mapX(p0)) / 6;
      const c1y = mapY(p1) + (mapY(p2) - mapY(p0)) / 6;
      const c2x = mapX(p2) - (mapX(p3) - mapX(p1)) / 6;
      const c2y = mapY(p2) - (mapY(p3) - mapY(p1)) / 6;
      d += ` C ${c1x.toFixed(2)} ${c1y.toFixed(2)}, ${c2x.toFixed(2)} ${c2y.toFixed(2)}, ${mapX(p2).toFixed(2)} ${mapY(p2).toFixed(2)}`;
    }
    return d;
  }

  const CONFIGS = {};
  for (const key of Object.keys(SINK_TABLES)) {
    const meta = SINK_TABLES[key];
    const anchors = sinkTableToAnchors(meta.sink_fps_mph);
    const smooth = buildSmoothPolar(anchors, 0.05);
    // Peak L/D from sink anchors (V/sink), not a separate L/D digitization.
    let best = anchors[0];
    for (const p of anchors) {
      if (p.ld > best.ld) best = p;
    }
    let minSink = smooth[0];
    for (const p of smooth) {
      if (Math.abs(p.vs_kt) < Math.abs(minSink.vs_kt)) minSink = p;
    }
    CONFIGS[key] = {
      key,
      label: meta.label,
      weight_lb: meta.weight_lb,
      wing_loading_psf: meta.wing_loading_psf,
      stall_mph: meta.stall_mph,
      vmax_mph: anchors[anchors.length - 1].mph,
      anchors,
      smooth,
      best_ld: best,
      min_sink: minSink,
      sampleAtMph: (mph) => samplePolarAtMph(anchors, mph)
    };
  }

  function getConfig(key) {
    return CONFIGS[key] || CONFIGS.dual;
  }

  function clampProbeMph(config, mph) {
    const cfg = getConfig(config);
    const v = Number(mph);
    if (!Number.isFinite(v)) return cfg.best_ld.mph;
    return Math.min(cfg.vmax_mph, Math.max(cfg.stall_mph, v));
  }

  /** L/D and sink at a chosen IAS (clamped to stall…Vmax for the config). */
  function probeAtAirspeed({ config = 'dual', airspeedMph } = {}) {
    const cfg = getConfig(config);
    const mph = clampProbeMph(config, airspeedMph);
    const p = samplePolarAtMph(cfg.anchors, mph);
    const sinkKt = Math.abs(p.vs_kt);
    const sinkFps = sinkKt * KT_TO_FPS;
    return {
      ok: true,
      config: cfg,
      mph: p.mph,
      ias_kt: p.ias_kt,
      vs_kt: p.vs_kt,
      ld: p.ld,
      sink_kt: sinkKt,
      sink_fps: sinkFps,
      sink_fpm: sinkFps * 60,
      stall_mph: cfg.stall_mph,
      vmax_mph: cfg.vmax_mph,
      at_stall: Math.abs(p.mph - cfg.stall_mph) < 0.05
    };
  }

  function findMacCreadyTangent({ config = 'dual', macCreadyKt = 2, windMph = 0 } = {}) {
    const cfg = getConfig(config);
    const mc = Number(macCreadyKt);
    const windMphN = Number(windMph);
    const windKt = windMphN * MPH_TO_KT;
    // Pivot on IAS axis: headwind → +|W|, tailwind → −|W| (windMph: +tail / −head).
    const originMph = -windMphN;
    const mphMin = cfg.anchors[0].mph;
    const mphMax = cfg.anchors[cfg.anchors.length - 1].mph;
    const lo = Math.max(mphMin, originMph + 1.5);
    const polarPayload = () =>
      cfg.smooth.map((p) => ({
        x_mph: p.mph,
        mph: p.mph,
        ias_kt: p.ias_kt,
        vs_kt: p.vs_kt,
        ld: p.ld
      }));

    if (lo >= mphMax - 0.25) {
      return {
        ok: false,
        error: 'No tangent (wind pivot leaves no polar points to the right)',
        config: cfg,
        origin_mph: originMph,
        polar_gs: polarPayload()
      };
    }

    const slopeAt = (mph) => {
      const p = samplePolarAtMph(cfg.anchors, mph);
      return (p.vs_kt - mc) / (mph - originMph);
    };
    const mphStar = maximizeUnimodal(slopeAt, lo, mphMax);
    const touch = samplePolarAtMph(cfg.anchors, mphStar);
    const gsMph = touch.mph + windMphN;
    const best = {
      ias_kt: touch.ias_kt,
      vs_kt: touch.vs_kt,
      gs_kt: gsMph * MPH_TO_KT,
      gs_mph: gsMph,
      slope: slopeAt(touch.mph),
      mph: touch.mph,
      ld: touch.ld
    };

    const sinkKt = Math.abs(best.vs_kt);
    const sinkFps = sinkKt * KT_TO_FPS;
    const airLd = best.ld;
    const groundLd = best.gs_mph > 0 ? best.gs_kt / sinkKt : null;
    const bestLd = cfg.best_ld.ld;
    const calmMph = maximizeUnimodal(
      (mph) => {
        const p = samplePolarAtMph(cfg.anchors, mph);
        return (p.vs_kt - mc) / mph;
      },
      Math.max(mphMin, 1.5),
      mphMax
    );
    const calmTouch = samplePolarAtMph(cfg.anchors, calmMph);

    return {
      ok: true,
      config: cfg,
      mac_cready_kt: mc,
      wind_mph: windMphN,
      wind_kt: windKt,
      origin_mph: originMph,
      tangent: best,
      line: { x0: originMph, y0: mc, x1: best.mph, y1: best.vs_kt },
      // Polar stays in IAS; x_mph is indicated airspeed (legacy key polar_gs kept for UI).
      polar_gs: polarPayload(),
      metrics: {
        sink_kt: sinkKt,
        sink_fps: sinkFps,
        sink_fpm: sinkFps * 60,
        air_ld: airLd,
        ground_ld: groundLd,
        best_ld: bestLd,
        air_ld_vs_best_pct: (airLd / bestLd) * 100,
        ground_ld_vs_best_pct: groundLd != null ? (groundLd / bestLd) * 100 : null,
        sink_vs_min_pct: (sinkKt / Math.abs(cfg.min_sink.vs_kt)) * 100,
        calm_stf_mph: calmTouch.mph,
        delta_stf_mph: best.mph - calmTouch.mph
      }
    };
  }

  function windLabel(windMph) {
    const w = Number(windMph);
    if (w === 0) return '0 mph calm';
    if (w > 0) return `${w} mph tailwind`;
    return `${Math.abs(w)} mph headwind`;
  }

  // Legacy evaluate API (mph / derived L/D from sink table)
  const POLAR = {
    aircraft: 'SGS 2-33A',
    source: 'POH sink-vs-IAS performance graph (digitized)',
    configs: Object.fromEntries(
      Object.entries(SINK_TABLES).map(([key, meta]) => [
        key,
        {
          label: meta.label,
          weight_lb: meta.weight_lb,
          wing_loading_psf: meta.wing_loading_psf,
          stall_mph: meta.stall_mph,
          points: sinkTableToAnchors(meta.sink_fps_mph).map((p) => ({
            mph: p.mph,
            ld: p.ld,
            sink_fps: p.sink_fps
          }))
        }
      ])
    )
  };

  function enrich(points) {
    return points.map((p) => {
      const sink_fps =
        p.sink_fps != null ? p.sink_fps : (p.mph * MPH_TO_FPS) / Math.max(1e-6, p.ld);
      const ld = p.ld != null ? p.ld : (p.mph * MPH_TO_FPS) / Math.max(1e-6, sink_fps);
      return { mph: p.mph, ld, sink_fps };
    });
  }

  function getConfigLegacy(key) {
    const cfg = POLAR.configs[key] || POLAR.configs.dual;
    return { ...cfg, key, points: enrich(cfg.points) };
  }

  function interpolatePoint(points, mph) {
    if (!points.length) return null;
    if (mph <= points[0].mph) return { ...points[0], clamped: mph < points[0].mph };
    if (mph >= points[points.length - 1].mph) {
      const last = points[points.length - 1];
      return { ...last, clamped: mph > last.mph };
    }
    for (let i = 0; i < points.length - 1; i += 1) {
      const a = points[i];
      const b = points[i + 1];
      if (mph >= a.mph && mph <= b.mph) {
        const t = (mph - a.mph) / (b.mph - a.mph);
        return {
          mph,
          ld: lerp(a.ld, b.ld, t),
          sink_fps: lerp(a.sink_fps, b.sink_fps, t),
          clamped: false
        };
      }
    }
    return null;
  }

  function evaluate({ config = 'dual', airspeedMph = 54, windMph = 0 } = {}) {
    const cfg = getConfigLegacy(config);
    const air = interpolatePoint(cfg.points, Number(airspeedMph));
    if (!air) return { ok: false, error: 'No polar data' };
    const groundMph = Number(airspeedMph) + Number(windMph);
    const groundFps = groundMph * MPH_TO_FPS;
    const sinkFps = air.sink_fps;
    const groundLd = groundFps > 0 && sinkFps > 0 ? groundFps / sinkFps : null;
    let best = cfg.points[0];
    for (const p of cfg.points) if (p.ld > best.ld) best = p;
    return {
      ok: true,
      config: cfg,
      airspeed_mph: Number(airspeedMph),
      wind_mph: Number(windMph),
      groundspeed_mph: groundMph,
      sink_fps: sinkFps,
      air_ld: air.ld,
      ground_ld: groundLd,
      glide_nm_per_1000: groundLd != null ? (groundLd * 1000) / 6076.12 : null,
      can_penetrate: groundMph > 0,
      best_ld: { mph: best.mph, ld: best.ld },
      polar_points: cfg.points
    };
  }

  function sampleGroundLdCurve(config, windMph, step = 2) {
    const cfg = getConfigLegacy(config);
    const out = [];
    for (let mph = cfg.points[0].mph; mph <= cfg.points[cfg.points.length - 1].mph + 0.001; mph += step) {
      const r = evaluate({ config, airspeedMph: mph, windMph });
      if (r.ok && r.can_penetrate && r.ground_ld != null) {
        out.push({ mph, ground_ld: r.ground_ld, air_ld: r.air_ld, sink_fps: r.sink_fps });
      }
    }
    return out;
  }

  global.Sgs233Polar = {
    POLAR,
    CONFIGS,
    KT_TO_MPH,
    MPH_TO_FPS,
    getConfig,
    evaluate,
    sampleGroundLdCurve,
    findMacCreadyTangent,
    probeAtAirspeed,
    clampProbeMph,
    windLabel,
    polarToBezierPath,
    buildSmoothPolar
  };
})(typeof window !== 'undefined' ? window : globalThis);
