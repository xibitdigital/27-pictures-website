declare module "*.wasm" {
  const wasmModule: WebAssembly.Module;
  export default wasmModule;
}

/**
 * @jsquash/png ships its own squoosh_png_bg.wasm.d.ts sibling (typed as the
 * wasm-bindgen export surface, no default export) which TS's "bundler"
 * resolution finds before the wildcard above. Override it for this exact
 * specifier so the import gets the compiled WebAssembly.Module Wrangler's
 * bundler actually produces.
 */
declare module "@jsquash/png/codec/pkg/squoosh_png_bg.wasm" {
  const wasmModule: WebAssembly.Module;
  export default wasmModule;
}
