// S09 dev-only profiling hook (dev/*.tsx sets it; the film never does).
export const DEV: { skip: Set<string>; mark?: (label: string, ctx: CanvasRenderingContext2D) => void } = { skip: new Set<string>() };
