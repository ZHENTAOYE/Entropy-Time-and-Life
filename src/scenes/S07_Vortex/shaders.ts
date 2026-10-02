// Water surface of the whirlpool, drawn ON THE FLOOR PLANE through the scene camera (so it tilts with the 3D move).
// The texture lives in flow-comoving coordinates of the spiral sink:
//   ψ = θ − k·ln(R0/r)      (constant along a streamline)
//   s = r² + q·t            (constant along a particle path)
// so the caustic filaments are advected exactly like the particles.
export const WATER_FRAG = `
uniform float u_t;
uniform float u_phi, u_th, u_ax, u_ay, u_zoom, u_D, u_roll;
uniform float u_mix;    // 0 = S06 deep space, 1 = water
uniform float u_tex;    // texture / pool visibility
uniform float u_k, u_R0, u_q, u_rc;
uniform float u_side;   // 0 top view .. 1 side-view backdrop

float h13(vec3 p){ p = fract(p*0.1031); p += dot(p, p.zyx + 31.32); return fract((p.x + p.y)*p.z); }
float vn3(vec3 p){
  vec3 i = floor(p); vec3 f = fract(p); f = f*f*(3.0 - 2.0*f);
  float a = h13(i), b = h13(i + vec3(1,0,0)), c = h13(i + vec3(0,1,0)), d = h13(i + vec3(1,1,0));
  float e = h13(i + vec3(0,0,1)), g = h13(i + vec3(1,0,1)), h = h13(i + vec3(0,1,1)), j = h13(i + vec3(1,1,1));
  return mix(mix(mix(a,b,f.x), mix(c,d,f.x), f.y), mix(mix(e,g,f.x), mix(h,j,f.x), f.y), f.z);
}

void main(){
  vec2 px = v_uv * vec2(1080.0, 1920.0);
  float sp = sin(u_phi), cp = cos(u_phi);
  float ex = px.x - u_ax, ey = px.y - u_ay;
  float cr = cos(u_roll), sr = sin(u_roll);
  float u = (ex * cr + ey * sr) / (u_zoom * u_D);
  float v = -(-ex * sr + ey * cr) / (u_zoom * u_D);
  float Ch = u_th + u_D * sp;
  float Cz = -u_D * cp;
  float dh = v * cp - sp;

  vec3 bg06 = vec3(4.0, 5.0, 11.0) / 255.0;
  vec3 deep = vec3(2.0, 20.0, 23.0) / 255.0;
  vec3 mid  = vec3(5.0, 40.0, 46.0) / 255.0;
  vec3 hi   = vec3(40.0, 150.0, 160.0) / 255.0;

  // backdrop for rays that miss the floor (side view): deep water column with a soft vertical falloff
  float sky = clamp(1.0 - v_uv.y * 0.6, 0.0, 1.0);
  vec3 col = deep * (0.55 + 0.35 * sky);

  if (dh < -1e-5) {
    float lam = -Ch / dh;
    vec2 w = vec2(lam * u, Cz + lam * (v * sp + cp));
    float r = length(w);
    float th = atan(w.y, w.x);
    float psi = th - u_k * log(u_R0 / max(r, 1.0));
    float s = (r * r + u_q * u_t) / (u_R0 * u_R0);
    vec3 P = vec3(cos(psi) * 2.6, sin(psi) * 2.6, s * 2.4);
    float n = vn3(P) * 0.62 + vn3(P * 2.17 + 7.3) * 0.38;
    float ridge = 1.0 - abs(2.0 * n - 1.0);
    ridge = ridge * ridge * ridge * ridge;
    float n2 = vn3(vec3(cos(psi) * 6.0, sin(psi) * 6.0, s * 5.5 + 3.1));
    float fine = pow(1.0 - abs(2.0 * n2 - 1.0), 6.0);

    float disc = smoothstep(u_R0 * 1.6, u_R0 * 0.35, r);
    float inner = smoothstep(u_rc * 1.2, u_rc * 2.6, r);
    float eye = smoothstep(u_rc * 0.35, u_rc * 1.1, r);
    float ring = exp(-pow((r - u_rc * 1.05) / (u_rc * 0.32), 2.0));

    float wide = smoothstep(u_R0 * 2.8, u_R0 * 0.3, r);
    vec3 water = mix(deep, mid, disc * 0.85 + wide * 0.25);
    water += hi * (ridge * 0.2 + fine * 0.08) * (0.35 * wide + 0.65 * disc) * inner * u_tex;
    water += hi * ring * 0.22 * u_tex;
    water *= mix(1.0, 0.25 + 0.75 * eye, u_tex);
    // far floor fades into the backdrop (side view)
    float far = smoothstep(2600.0, 5200.0, lam);
    col = mix(water, col, far * u_side + (1.0 - u_tex) * u_side);
  }
  col = mix(bg06, col, u_mix);
  // vignette
  vec2 q = v_uv - 0.5;
  col *= 1.0 - 0.55 * smoothstep(0.25, 0.95, length(q * vec2(1.0, 0.75)) * 1.15);
  gl_FragColor = vec4(col, 1.0);
}
`;
