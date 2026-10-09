/**
 * SGS 2-33 polar + MacCready tangent construction (browser).
 * Chart units: IAS knots, vertical speed knots (+ climb / − sink).
 * Wind: positive = tailwind kt, negative = headwind kt (shifts polar on GS axis).
 */
(function (global) {
  const KT_TO_MPH = 1.1507794;

  /**
   * Digitized from MacCready construction chart (smooth-looking control points).
   * Dense enough that Catmull–Rom resampling looks continuous on screen.
   */
  const ANCHOR_POINTS = [
    { ias_kt: 28, vs_kt: -1.62 },
    { ias_kt: 30, vs_kt: -1.68 },
    { ias_kt: 32, vs_kt: -1.72 },
    { ias_kt: 34, vs_kt: -1.76 },
    { ias_kt: 36, vs_kt: -1.80 },
    { ias_kt: 38, vs_kt: -1.85 },
    { ias_kt: 40, vs_kt: -1.90 },
    { ias_kt: 42, vs_kt: -1.94 },
    { ias_kt: 44, vs_kt: -1.98 },
    { ias_kt: 46, vs_kt: -2.04 },
    { ias_kt: 48, vs_kt: -2.10 },
    { ias_kt: 50, vs_kt: -2.16 },
    { ias_kt: 51, vs_kt: -2.20 },
    { ias_kt: 52, vs_kt: -2.26 },
    { ias_kt: 54, vs_kt: -2.40 },
    { ias_kt: 55, vs_kt: -2.50 },
    { ias_kt: 56, vs_kt: -2.62 },
    { ias_kt: 58, vs_kt: -2.88 },
    { ias_kt: 60, vs_kt: -3.20 },
    { ias_kt: 62, vs_kt: -3.55 },
    { ias_kt: 64, vs_kt: -3.90 },
    { ias_kt: 65, vs_kt: -4.05 },
    { ias_kt: 66, vs_kt: -4.25 },
    { ias_kt: 68, vs_kt: -4.60 },
    { ias_kt: 70, vs_kt: -5.00 },
    { ias_kt: 72, vs_kt: -5.40 },
    { ias_kt: 74, vs_kt: -5.80 },
    { ias_kt: 75, vs_kt: -6.00 }
  ];

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

  /** Resample anchors to ~0.5 kt spacing for a visually smooth curve. */
  function buildSmoothPolar(stepKt = 0.5) {
    const pts = ANCHOR_POINTS;
    const out = [];
    for (let i = 0; i < pts.length - 1; i += 1) {
      const p0 = pts[Math.max(0, i - 1)];
      const p1 = pts[i];
      const p2 = pts[i + 1];
      const p3 = pts[Math.min(pts.length - 1, i + 2)];
      const segLen = Math.max(1, Math.round((p2.ias_kt - p1.ias_kt) / stepKt));
      for (let s = 0; s < segLen; s += 1) {
        const t = s / segLen;
        out.push({
          ias_kt: catmullRom(p0.ias_kt, p1.ias_kt, p2.ias_kt, p3.ias_kt, t),
          vs_kt: catmullRom(p0.vs_kt, p1.vs_kt, p2.vs_kt, p3.vs_kt, t)
        });
      }
    }
    out.push({ ...pts[pts.length - 1] });
    return out;
  }

  const SMOOTH_POLAR = buildSmoothPolar(0.5);

  function interpolateVs(iasKt) {
    const pts = SMOOTH_POLAR;
    if (iasKt <= pts[0].ias_kt) return pts[0].vs_kt;
    if (iasKt >= pts[pts.length - 1].ias_kt) return pts[pts.length - 1].vs_kt;
    for (let i = 0; i < pts.length - 1; i += 1) {
      const a = pts[i];
      const b = pts[i + 1];
      if (iasKt >= a.ias_kt && iasKt <= b.ias_kt) {
        const t = (iasKt - a.ias_kt) / (b.ias_kt - a.ias_kt || 1);
        return lerp(a.vs_kt, b.vs_kt, t);
      }
    }
    return pts[pts.length - 1].vs_kt;
  }

  /**
   * MacCready: maximize slope from (0, mc) to each polar point in GS frame.
   * slope = (vs - mc) / gs, gs = ias + wind.
   */
  function findMacCreadyTangent({ macCreadyKt = 2, windKt = 0 } = {}) {
    const mc = Number(macCreadyKt);
    const wind = Number(windKt);
    let best = null;
    for (const p of SMOOTH_POLAR) {
      const gs = p.ias_kt + wind;
      if (gs <= 1) continue;
      const slope = (p.vs_kt - mc) / gs;
      if (!best || slope > best.slope) {
        best = {
          ias_kt: p.ias_kt,
          vs_kt: p.vs_kt,
          gs_kt: gs,
          slope,
          mph: p.ias_kt * KT_TO_MPH
        };
      }
    }
    if (!best) {
      return { ok: false, error: 'No tangent (wind too strong vs polar)' };
    }
    return {
      ok: true,
      mac_cready_kt: mc,
      wind_kt: wind,
      tangent: best,
      // Line from (0, mc) through tangent point, extended for drawing
      line: {
        x0: 0,
        y0: mc,
        x1: best.gs_kt,
        y1: best.vs_kt
      },
      polar_gs: SMOOTH_POLAR.map((p) => ({
        x_kt: p.ias_kt + wind, // groundspeed axis for wind-shifted polar
        ias_kt: p.ias_kt,
        vs_kt: p.vs_kt
      })).filter((p) => p.x_kt > 0)
    };
  }

  function windLabel(windKt) {
    const w = Number(windKt);
    if (w === 0) return '0 kt calm';
    if (w > 0) return `${w} kt tailwind`;
    return `${Math.abs(w)} kt headwind`;
  }

  // --- legacy L/D helpers (kept for older evaluate callers / tests) ---
  const MPH_TO_FPS = 5280 / 3600;
  const POLAR = {
    aircraft: 'SGS 2-33A',
    source: 'MacCready chart digitization + SFM performance curves',
    configs: {
      solo: {
        label: 'Solo',
        weight_lb: 790,
        wing_loading_psf: 3.6,
        points: [
          { mph: 36, ld: 16.8 },
          { mph: 42, ld: 21.6 },
          { mph: 48, ld: 22.6 },
          { mph: 54, ld: 21.8 },
          { mph: 60, ld: 19.5 },
          { mph: 66, ld: 17.5 },
          { mph: 72, ld: 15.8 },
          { mph: 78, ld: 14.2 },
          { mph: 84, ld: 12.8 },
          { mph: 90, ld: 11.4 }
        ]
      },
      dual: {
        label: 'Dual',
        weight_lb: 1040,
        wing_loading_psf: 4.74,
        points: [
          { mph: 42, ld: 17.0 },
          { mph: 48, ld: 22.0 },
          { mph: 54, ld: 23.0 },
          { mph: 60, ld: 21.4 },
          { mph: 66, ld: 19.2 },
          { mph: 72, ld: 17.0 },
          { mph: 78, ld: 15.2 },
          { mph: 84, ld: 13.5 },
          { mph: 90, ld: 12.2 }
        ]
      }
    }
  };

  function enrich(points) {
    return points.map((p) => {
      const vFps = p.mph * MPH_TO_FPS;
      const sinkFps = vFps / p.ld;
      return { mph: p.mph, ld: p.ld, sink_fps: sinkFps };
    });
  }

  function getConfig(key) {
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
    const cfg = getConfig(config);
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
    const cfg = getConfig(config);
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
    ANCHOR_POINTS,
    SMOOTH_POLAR,
    KT_TO_MPH,
    MPH_TO_FPS,
    getConfig,
    evaluate,
    sampleGroundLdCurve,
    interpolateVs,
    findMacCreadyTangent,
    windLabel,
    buildSmoothPolar
  };
})(typeof window !== 'undefined' ? window : globalThis);
