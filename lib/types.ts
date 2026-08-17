export type Turno = "MANHA" | "TARDE" | "NOITE";
export type TipoColeta = "AUTO" | "OBSERVADO";
export type ModoColeta = "FLUXO" | "CICLO" | "AVULSA" | "CICLO_EM_FLUXO" | "INTERRUPCAO";
export type Natureza = "Rotina" | "Eventual";
export type StatusRegistro = "VALIDA" | "DESCARTADA" | "SUSPEITA";

export type Colaborador = {
  id: number;
  nome: string;
  ativo: boolean;
  eh_observador: boolean;
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
  codigo: string;
  processo_id: number;
  nome: string;
  tipo_atividade: string;
  natureza: Natureza;
  modo: ModoColeta;
  unidade: string | null;
  requer_quantidade: boolean;
  meta_amostras: number;
  ativo: boolean;
  interrompe_fluxo_id: number | null;
  interrupcao_global: boolean;
  exige_motivo: boolean;
};

export type FluxoEtapa = {
  id: number;
  fluxo_id: number;
  atividade_id: number;
  ordem: number;
  variante: boolean;
  opcional: boolean;
  condicao: string | null;
  modo_etapa: ModoColeta;
};

// Estado da sessão persistido em sessionStorage — sobrevive a refresh acidental (R11).
export type SessaoAtiva = {
  id: string;
  colaboradorId: number;
  colaboradorNome: string;
  processoId: number;
  processoNome: string;
  turno: Turno;
  tipoColeta: TipoColeta;
  observadorId: number | null;
  observadorNome: string | null;
  dispositivo: string;
  iniciadaEm: string;
};
