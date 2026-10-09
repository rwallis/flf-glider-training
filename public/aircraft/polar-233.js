/**
 * SGS 2-33A polar helpers (browser).
 * Wind: positive = tailwind mph, negative = headwind mph.
 */
(function (global) {
  const MPH_TO_FPS = 5280 / 3600;

  const POLAR = {
    aircraft: 'SGS 2-33A',
    source: 'Calculated Performance Curves S.G.S. 2-33A (SFM p.1-15)',
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
    return {
      ...cfg,
      key,
      points: enrich(cfg.points)
    };
  }

  function lerp(a, b, t) {
    return a + (b - a) * t;
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

  /**
   * @param {object} opts
   * @param {'solo'|'dual'} opts.config
   * @param {number} opts.airspeedMph
   * @param {number} opts.windMph positive tailwind, negative headwind
   */
  function evaluate({ config = 'dual', airspeedMph = 54, windMph = 0 } = {}) {
    const cfg = getConfig(config);
    const air = interpolatePoint(cfg.points, Number(airspeedMph));
    if (!air) {
      return { ok: false, error: 'No polar data' };
    }
    const groundMph = Number(airspeedMph) + Number(windMph);
    const airFps = Number(airspeedMph) * MPH_TO_FPS;
    const groundFps = groundMph * MPH_TO_FPS;
    const sinkFps = air.sink_fps;
    const airLd = air.ld;
    const groundLd = groundFps > 0 && sinkFps > 0 ? groundFps / sinkFps : null;
    const ftPerNm = 6076.12;
    const glideFtPer1000 = groundLd != null ? groundLd * 1000 : null;
    const glideNmPer1000 = groundLd != null ? (groundLd * 1000) / ftPerNm : null;

    // Best air L/D on this config
    let best = cfg.points[0];
    for (const p of cfg.points) {
      if (p.ld > best.ld) best = p;
    }

    return {
      ok: true,
      config: cfg,
      airspeed_mph: Number(airspeedMph),
      wind_mph: Number(windMph),
      wind_label:
        Number(windMph) === 0
          ? 'Calm'
          : Number(windMph) > 0
            ? `${Math.abs(Number(windMph))} mph tailwind`
            : `${Math.abs(Number(windMph))} mph headwind`,
      groundspeed_mph: groundMph,
      sink_fps: sinkFps,
      sink_fpm: sinkFps * 60,
      air_ld: airLd,
      ground_ld: groundLd,
      glide_ft_per_1000: glideFtPer1000,
      glide_nm_per_1000: glideNmPer1000,
      can_penetrate: groundMph > 0,
      clamped: Boolean(air.clamped),
      best_ld: { mph: best.mph, ld: best.ld },
      polar_points: cfg.points
    };
  }

  function sampleGroundLdCurve(config, windMph, step = 2) {
    const cfg = getConfig(config);
    const min = cfg.points[0].mph;
    const max = cfg.points[cfg.points.length - 1].mph;
    const out = [];
    for (let mph = min; mph <= max + 0.001; mph += step) {
      const r = evaluate({ config, airspeedMph: mph, windMph });
      if (r.ok && r.can_penetrate && r.ground_ld != null) {
        out.push({ mph, ground_ld: r.ground_ld, air_ld: r.air_ld, sink_fps: r.sink_fps });
      }
    }
    return out;
  }

  global.Sgs233Polar = {
    POLAR,
    MPH_TO_FPS,
    getConfig,
    evaluate,
    sampleGroundLdCurve
  };
})(typeof window !== 'undefined' ? window : globalThis);
