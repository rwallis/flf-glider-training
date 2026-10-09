/**
 * SGS 2-33 polar + MacCready tangent construction (browser).
 * Chart units: IAS knots, vertical speed knots (+ climb / − sink).
 * Wind: positive = tailwind kt, negative = headwind kt (shifts polar on GS axis).
 */
(function (global) {
  const KT_TO_MPH = 1.1507794;
  const MPH_TO_KT = 1 / KT_TO_MPH;
  const MPH_TO_FPS = 5280 / 3600;
  const KT_TO_FPS = 6076.12 / 3600;

  /**
   * SFM L/D anchors (mph) — densified, then converted to IAS/VS knots.
   * Extra midpoints keep Catmull–Rom / Bezier output smooth on screen.
   */
  const LD_TABLES = {
    solo: {
      label: 'Solo',
      weight_lb: 790,
      wing_loading_psf: 3.6,
      ld_mph: [
        [36, 16.8],
        [39, 19.8],
        [42, 21.6],
        [45, 22.3],
        [48, 22.6],
        [51, 22.3],
        [54, 21.8],
        [57, 20.7],
        [60, 19.5],
        [63, 18.5],
        [66, 17.5],
        [69, 16.6],
        [72, 15.8],
        [75, 15.0],
        [78, 14.2],
        [81, 13.5],
        [84, 12.8],
        [87, 12.1],
        [90, 11.4]
      ]
    },
    dual: {
      label: 'Dual',
      weight_lb: 1040,
      wing_loading_psf: 4.74,
      ld_mph: [
        [42, 17.0],
        [45, 20.0],
        [48, 22.0],
        [51, 22.7],
        [54, 23.0],
        [57, 22.3],
        [60, 21.4],
        [63, 20.3],
        [66, 19.2],
        [69, 18.1],
        [72, 17.0],
        [75, 16.1],
        [78, 15.2],
        [81, 14.3],
        [84, 13.5],
        [87, 12.8],
        [90, 12.2]
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

  function ldTableToAnchors(ldMph) {
    return ldMph.map(([mph, ld]) => {
      const ias_kt = mph * MPH_TO_KT;
      const vs_kt = -(ias_kt / ld);
      return { ias_kt, vs_kt, mph, ld };
    });
  }

  /** Dense resample (~0.2 kt) for smooth curves + accurate MacCready search. */
  function buildSmoothPolar(anchors, stepKt = 0.2) {
    const pts = anchors;
    const out = [];
    for (let i = 0; i < pts.length - 1; i += 1) {
      const p0 = pts[Math.max(0, i - 1)];
      const p1 = pts[i];
      const p2 = pts[i + 1];
      const p3 = pts[Math.min(pts.length - 1, i + 2)];
      const segLen = Math.max(2, Math.round((p2.ias_kt - p1.ias_kt) / stepKt));
      for (let s = 0; s < segLen; s += 1) {
        const t = s / segLen;
        const ias = catmullRom(p0.ias_kt, p1.ias_kt, p2.ias_kt, p3.ias_kt, t);
        const vs = catmullRom(p0.vs_kt, p1.vs_kt, p2.vs_kt, p3.vs_kt, t);
        const mph = ias * KT_TO_MPH;
        const ld = ias / Math.max(0.05, Math.abs(vs));
        out.push({ ias_kt: ias, vs_kt: vs, mph, ld });
      }
    }
    const last = pts[pts.length - 1];
    out.push({
      ias_kt: last.ias_kt,
      vs_kt: last.vs_kt,
      mph: last.mph,
      ld: last.ld
    });
    return out;
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
  for (const key of Object.keys(LD_TABLES)) {
    const meta = LD_TABLES[key];
    const anchors = ldTableToAnchors(meta.ld_mph);
    const smooth = buildSmoothPolar(anchors, 0.2);
    let best = smooth[0];
    let minSink = smooth[0];
    for (const p of smooth) {
      if (p.ld > best.ld) best = p;
      if (Math.abs(p.vs_kt) < Math.abs(minSink.vs_kt)) minSink = p;
    }
    CONFIGS[key] = {
      key,
      label: meta.label,
      weight_lb: meta.weight_lb,
      wing_loading_psf: meta.wing_loading_psf,
      anchors,
      smooth,
      best_ld: best,
      min_sink: minSink
    };
  }

  function getConfig(key) {
    return CONFIGS[key] || CONFIGS.dual;
  }

  function findMacCreadyTangent({ config = 'dual', macCreadyKt = 2, windKt = 0 } = {}) {
    const cfg = getConfig(config);
    const mc = Number(macCreadyKt);
    const wind = Number(windKt);
    let best = null;
    for (const p of cfg.smooth) {
      const gs = p.ias_kt + wind;
      if (gs <= 1) continue;
      const slope = (p.vs_kt - mc) / gs;
      if (!best || slope > best.slope) {
        best = {
          ias_kt: p.ias_kt,
          vs_kt: p.vs_kt,
          gs_kt: gs,
          slope,
          mph: p.mph,
          ld: p.ld
        };
      }
    }
    if (!best) {
      return { ok: false, error: 'No tangent (wind too strong vs polar)', config: cfg };
    }

    const sinkKt = Math.abs(best.vs_kt);
    const sinkFps = sinkKt * KT_TO_FPS;
    const airLd = best.ld;
    const groundLd = best.gs_kt / sinkKt;
    const bestLd = cfg.best_ld.ld;
    const calmTangent = (() => {
      let b = null;
      for (const p of cfg.smooth) {
        if (p.ias_kt <= 1) continue;
        const slope = (p.vs_kt - mc) / p.ias_kt;
        if (!b || slope > b.slope) b = { ...p, slope, gs_kt: p.ias_kt };
      }
      return b;
    })();

    return {
      ok: true,
      config: cfg,
      mac_cready_kt: mc,
      wind_kt: wind,
      tangent: best,
      line: { x0: 0, y0: mc, x1: best.gs_kt, y1: best.vs_kt },
      polar_gs: cfg.smooth.map((p) => ({
        x_kt: p.ias_kt + wind,
        ias_kt: p.ias_kt,
        vs_kt: p.vs_kt,
        ld: p.ld
      })).filter((p) => p.x_kt > 0),
      metrics: {
        sink_kt: sinkKt,
        sink_fps: sinkFps,
        sink_fpm: sinkFps * 60,
        air_ld: airLd,
        ground_ld: groundLd,
        best_ld: bestLd,
        air_ld_vs_best_pct: (airLd / bestLd) * 100,
        ground_ld_vs_best_pct: (groundLd / bestLd) * 100,
        sink_vs_min_pct: (sinkKt / Math.abs(cfg.min_sink.vs_kt)) * 100,
        calm_stf_kt: calmTangent ? calmTangent.ias_kt : null,
        delta_stf_kt: calmTangent ? best.ias_kt - calmTangent.ias_kt : 0
      }
    };
  }

  function windLabel(windKt) {
    const w = Number(windKt);
    if (w === 0) return '0 kt calm';
    if (w > 0) return `${w} kt tailwind`;
    return `${Math.abs(w)} kt headwind`;
  }

  // Legacy evaluate API (mph / L/D table)
  const POLAR = {
    aircraft: 'SGS 2-33A',
    source: 'SFM calculated performance curves (digitized)',
    configs: Object.fromEntries(
      Object.entries(LD_TABLES).map(([key, meta]) => [
        key,
        {
          label: meta.label,
          weight_lb: meta.weight_lb,
          wing_loading_psf: meta.wing_loading_psf,
          points: meta.ld_mph.map(([mph, ld]) => ({ mph, ld }))
        }
      ])
    )
  };

  function enrich(points) {
    return points.map((p) => {
      const vFps = p.mph * MPH_TO_FPS;
      return { mph: p.mph, ld: p.ld, sink_fps: vFps / p.ld };
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
    windLabel,
    polarToBezierPath,
    buildSmoothPolar
  };
})(typeof window !== 'undefined' ? window : globalThis);
