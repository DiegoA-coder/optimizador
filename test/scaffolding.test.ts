import { describe, expect, it } from "vitest";

// Smoke test: verifica que el runner de tests y globals funcionan.
// Se puede eliminar cuando existan tests reales de dominio/io.
describe("scaffolding", () => {
  it("vitest ejecuta y globals están activos", () => {
    expect(1 + 1).toBe(2);
  });
});
