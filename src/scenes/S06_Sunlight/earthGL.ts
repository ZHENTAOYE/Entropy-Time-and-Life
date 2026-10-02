// The Earth as seen from orbit, shaded on the GPU (offscreen) at ½ resolution:
//  · a 512×256 equirectangular cloud + continent map is GENERATED once per tab by a noise shader (3D value-noise fbm on
//    the unit sphere: no seams; domain-warped clouds with latitude banding; deserts, forests, polar ice);
//  · every frame the visible cap of the sphere is ray-cast against it (orthographic, the map's pole tilted back so the
//    face spans ±35° latitude), the clouds drift in longitude, lit by the Sun above-and-behind: a lit crescent at the
//    limb, a soft terminator, a calm dark face below (the narration lane), Rayleigh-blue limb, a small ocean glint.
import { bakeGL, renderGLSize } from './glOff';
import { EARTH, LIMB_Y } from './palette';

const NOISE = `
float h31(vec3 p){ p = fract(p*0.3183099 + 0.1); p *= 17.0; return fract(p.x*p.y*p.z*(p.x+p.y+p.z)); }
float vn(vec3 x){
  vec3 i = floor(x); vec3 f = fract(x); f = f*f*(3.0-2.0*f);
  return mix(mix(mix(h31(i), h31(i+vec3(1,0,0)), f.x), mix(h31(i+vec3(0,1,0)), h31(i+vec3(1,1,0)), f.x), f.y),
             mix(mix(h31(i+vec3(0,0,1)), h31(i+vec3(1,0,1)), f.x), mix(h31(i+vec3(0,1,1)), h31(i+vec3(1,1,1)), f.x), f.y), f.z);
}
float fbm4(vec3 p){ float a = 0.5, s = 0.0; for (int i = 0; i < 4; i++){ s += a*vn(p); p = p*2.03 + vec3(1.7, 9.2, 3.1); a *= 0.5; } return s; }
float fbm6(vec3 p){ float a = 0.5, s = 0.0; for (int i = 0; i < 6; i++){ s += a*vn(p); p = p*2.03 + vec3(1.7, 9.2, 3.1); a *= 0.5; } return s; }
`;

const MAP_FRAG = `
uniform float u_mode; // 0 = surface colour, 1 = cloud density
${NOISE}
void main(){
  float lon = v_uv.x * 6.2831853;
  float lat = (0.5 - v_uv.y) * 3.14159265;
  vec3 p = vec3(cos(lat)*cos(lon), cos(lat)*sin(lon), sin(lat));
  if (u_mode < 0.5) {
    float h = fbm6(p*1.6 + vec3(3.1, 0.4, 7.7)) + 0.35*fbm4(p*4.6 + 11.0) - 0.80;
    float land = smoothstep(0.0, 0.03, h);
    float shallow = smoothstep(-0.10, 0.0, h);
    vec3 ocean = mix(vec3(0.030, 0.105, 0.215), vec3(0.075, 0.27, 0.40), shallow);
    float subtrop = smoothstep(0.15, 0.45, abs(lat)) * (1.0 - smoothstep(0.5, 0.75, abs(lat)));
    float dry = smoothstep(0.42, 0.62, fbm4(p*2.6 + 7.0) + 0.18*subtrop);
    vec3 forest = vec3(0.13, 0.22, 0.09), desert = vec3(0.50, 0.40, 0.25), rock = vec3(0.33, 0.29, 0.25);
    vec3 lnd = mix(forest, desert, dry);
    lnd = mix(lnd, rock, smoothstep(0.10, 0.26, h));
    lnd *= 0.85 + 0.3*vn(p*24.0);
    float ice = smoothstep(1.12, 1.30, abs(lat) + 0.25*fbm4(p*5.0));
    vec3 surf = mix(ocean, lnd, land);
    surf = mix(surf, vec3(0.86, 0.90, 0.95), ice);
    gl_FragColor = vec4(surf, 1.0);
  } else {
    vec3 q = vec3(fbm4(p*2.0 + 1.3), fbm4(p*2.0 + 7.7), fbm4(p*2.0 + 4.2));
    float c = fbm6(p*3.1 + q*2.4);
    // ITCZ near the equator, storm belts at mid latitudes, clear subtropics
    float band = 0.10*exp(-pow(lat/0.12, 2.0)) + 0.08*exp(-pow((abs(lat) - 0.85)/0.18, 2.0)) - 0.06*exp(-pow((abs(lat) - 0.45)/0.12, 2.0));
    float d = smoothstep(0.50, 0.74, c + band);
    float wisp = smoothstep(0.55, 0.85, fbm4(vec3(p.x*7.0, p.y*7.0, p.z*1.5) + q*3.0)) * 0.35;
    gl_FragColor = vec4(vec3(clamp(d + wisp*(1.0 - d), 0.0, 1.0)), 1.0);
  }
}`;

export const EARTH_CAP = { w: 540, h: 334, y0: LIMB_Y - 4 } as const; // covers y 1286 … 1954 at ½ res

const EARTH_FRAG = `
uniform sampler2D u_surf_rep;
uniform sampler2D u_cloud_rep;
uniform float u_drift;
uniform float u_cdrift;
uniform float u_beta;
uniform float u_y0;
const vec3 C = vec3(${EARTH.cx.toFixed(1)}, ${EARTH.cy.toFixed(1)}, ${EARTH.r.toFixed(1)});
void main(){
  vec2 P = vec2(v_uv.x * ${(EARTH_CAP.w * 2).toFixed(1)}, u_y0 + v_uv.y * ${(EARTH_CAP.h * 2).toFixed(1)});
  float xp = (P.x - C.x) / C.z, yp = (C.y - P.y) / C.z;
  float rho = sqrt(xp*xp + yp*yp);
  if (rho >= 1.0) { gl_FragColor = vec4(0.0); return; }
  float edge = 1.0 - smoothstep(1.0 - 2.2/C.z, 1.0, rho);
  float zp = sqrt(max(0.0, 1.0 - rho*rho));
  vec3 n = vec3(xp, yp, zp);
  // map frame: pole tilted back and a little sideways
  vec3 pole = normalize(vec3(0.16, 0.52, -0.84));
  vec3 e1 = normalize(cross(vec3(0.0, 0.0, 1.0), pole));
  vec3 e2 = cross(pole, e1);
  float lat = asin(clamp(dot(n, pole), -1.0, 1.0));
  float lon = atan(dot(n, e2), dot(n, e1));
  vec2 uvS = vec2(lon / 6.2831853 + u_drift, 0.5 - lat / 3.14159265);
  vec2 uvC = vec2(lon / 6.2831853 + u_cdrift, 0.5 - lat / 3.14159265);
  vec3 surf = texture2D(u_surf_rep, uvS).rgb;
  float cloud = texture2D(u_cloud_rep, uvC).r;
  // the Sun: above the frame and behind the planet
  vec3 S = normalize(vec3(0.0, 1.0, -u_beta));
  float ndl = dot(n, S);
  float day = smoothstep(-0.10, 0.30, ndl);
  float lam = max(ndl, 0.0);
  vec3 lit = surf * (0.025 + 2.0*lam*day);
  float oceanF = smoothstep(0.02, 0.12, surf.b - surf.r);
  vec3 Hv = normalize(S + vec3(0.0, 0.0, 1.0));
  float spec = pow(max(dot(n, Hv), 0.0), 90.0) * oceanF * (1.0 - cloud) * 0.32 * day;
  vec3 cloudC = vec3(0.92, 0.95, 1.0) * (0.015 + 1.55*lam*day);
  // cloud shadows darken the ground a touch
  vec3 col = mix(lit * (1.0 - 0.25*cloud) + spec*vec3(1.0, 0.92, 0.78), cloudC, cloud*0.94);
  col += vec3(0.008, 0.018, 0.040) * (1.0 - day);
  // Rayleigh: blue limb + a thin blue veil over the day side
  float rim = pow(1.0 - zp, 2.4);
  col = mix(col, vec3(0.32, 0.62, 0.98) * (0.25 + 0.9*smoothstep(-0.3, 0.4, ndl)), clamp(rim*0.85, 0.0, 1.0));
  col += vec3(0.05, 0.12, 0.24) * day * 0.5;
  gl_FragColor = vec4(col * edge, edge);
}`;

export const surfMap = () => bakeGL('earthSurf', MAP_FRAG, { u_mode: 0 }, 512, 256);
export const cloudMap = () => bakeGL('earthCloud', MAP_FRAG, { u_mode: 1 }, 512, 256);

/** the shaded cap (½ res) for this frame */
export function earthCap(frame: number, beta: number): HTMLCanvasElement {
  return renderGLSize(EARTH_FRAG, { u_drift: frame * 0.00008, u_cdrift: frame * 0.00016, u_beta: beta, u_y0: EARTH_CAP.y0 }, { u_surf_rep: surfMap(), u_cloud_rep: cloudMap() }, EARTH_CAP.w, EARTH_CAP.h);
}
