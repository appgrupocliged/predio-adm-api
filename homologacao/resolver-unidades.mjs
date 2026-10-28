// CLIGED QR — resolução de unidade/local (homologação, ainda não integrado ao Worker).
// Sem efeitos colaterais: não cria chamados, não acessa redes, não altera dados.
export function resolverLocal(catalogo, { unit_code, local_code } = {}) {
  if (!catalogo || !catalogo.units || !catalogo.default_unit) {
    throw new Error("Catálogo de unidades inválido.");
  }
  const legado = unit_code == null;
  const unidadeCodigo = legado
    ? catalogo.default_unit
    : normalizarCodigo(unit_code, "unidade");
  const localCodigo = normalizarCodigo(local_code, "local");

  if (!Object.hasOwn(catalogo.units, unidadeCodigo)) {
    throw new Error("Unidade não cadastrada.");
  }
  const unidade = catalogo.units[unidadeCodigo];
  if (!Object.hasOwn(unidade.locations || {}, localCodigo)) {
    throw new Error("Local não cadastrado na unidade.");
  }
  return Object.freeze({
    unit_code: unidadeCodigo,
    unit_name: unidade.name,
    local_code: localCodigo,
    local_name: unidade.locations[localCodigo],
    location_id: unidadeCodigo + ":" + localCodigo,
    legacy_link: legado
  });
}

function normalizarCodigo(valor, nome) {
  if (typeof valor !== "string" || !valor.trim()) {
    throw new Error("Código de " + nome + " inválido.");
  }
  return valor.trim().toUpperCase();
}
