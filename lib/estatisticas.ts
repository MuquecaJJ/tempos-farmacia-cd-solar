export function media(valores: number[]): number {
  if (valores.length === 0) return 0;
  return valores.reduce((soma, v) => soma + v, 0) / valores.length;
}

export function mediana(valores: number[]): number {
  if (valores.length === 0) return 0;
  const ordenados = [...valores].sort((a, b) => a - b);
  const meio = Math.floor(ordenados.length / 2);
  return ordenados.length % 2 === 0
    ? (ordenados[meio - 1] + ordenados[meio]) / 2
    : ordenados[meio];
}

export function desvioPadrao(valores: number[]): number {
  if (valores.length < 2) return 0;
  const m = media(valores);
  const somaQuadrados = valores.reduce((soma, v) => soma + (v - m) ** 2, 0);
  return Math.sqrt(somaQuadrados / (valores.length - 1));
}

export function coeficienteVariacao(valores: number[]): number {
  const m = media(valores);
  if (m === 0) return 0;
  return desvioPadrao(valores) / m;
}

export function percentil(valores: number[], p: number): number {
  if (valores.length === 0) return 0;
  const ordenados = [...valores].sort((a, b) => a - b);
  if (ordenados.length === 1) return ordenados[0];
  const indice = (p / 100) * (ordenados.length - 1);
  const inferior = Math.floor(indice);
  const superior = Math.ceil(indice);
  if (inferior === superior) return ordenados[inferior];
  const fracao = indice - inferior;
  return ordenados[inferior] + (ordenados[superior] - ordenados[inferior]) * fracao;
}

export type Resumo = {
  n: number;
  media: number;
  mediana: number;
  desvioPadrao: number;
  cv: number;
  min: number;
  max: number;
  p90: number;
};

export function resumir(valores: number[]): Resumo {
  if (valores.length === 0) {
    return { n: 0, media: 0, mediana: 0, desvioPadrao: 0, cv: 0, min: 0, max: 0, p90: 0 };
  }
  return {
    n: valores.length,
    media: media(valores),
    mediana: mediana(valores),
    desvioPadrao: desvioPadrao(valores),
    cv: coeficienteVariacao(valores),
    min: Math.min(...valores),
    max: Math.max(...valores),
    p90: percentil(valores, 90),
  };
}
