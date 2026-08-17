export type Turno = "MANHA" | "TARDE" | "NOITE";
export type TipoColeta = "AUTO" | "OBSERVADO";
export type ModoColeta = "FLUXO" | "CICLO" | "AVULSA";
export type Natureza = "Rotina" | "Eventual";
export type StatusRegistro = "VALIDA" | "DESCARTADA" | "SUSPEITA";

export type Papel = {
  id: number;
  nome: string;
  ordem: number;
};

export type Colaborador = {
  id: number;
  nome: string;
  ativo: boolean;
};

export type Processo = {
  id: number;
  codigo: string;
  nome: string;
  ordem: number;
};

export type Fluxo = {
  id: number;
  processo_id: number;
  nome: string;
  unidade_corrida: string;
  ordem: number;
};

export type Atividade = {
  id: number;
  numero: number;
  processo_id: number;
  papel_id: number;
  nome: string;
  tipo_atividade: string;
  natureza: Natureza;
  modo: ModoColeta;
  unidade: string | null;
  requer_quantidade: boolean;
  meta_amostras: number;
  ativo: boolean;
};

export type FluxoEtapa = {
  id: number;
  fluxo_id: number;
  atividade_id: number;
  ordem: number;
  variante: boolean;
  opcional: boolean;
};

// Estado da sessão persistido em sessionStorage — sobrevive a refresh acidental (R11).
export type SessaoAtiva = {
  id: string;
  colaboradorId: number;
  colaboradorNome: string;
  processoId: number;
  processoNome: string;
  papelId: number;
  papelNome: string;
  turno: Turno;
  tipoColeta: TipoColeta;
  observadorId: number | null;
  observadorNome: string | null;
  dispositivo: string;
  iniciadaEm: string;
};
