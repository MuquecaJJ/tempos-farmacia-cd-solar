"use client";

import { useMemo, useState } from "react";

type Item = { id: number; nome: string };

export function BuscaLista({
  label,
  items,
  selecionadoId,
  onSelecionar,
  placeholder = "Digite para buscar...",
}: {
  label: string;
  items: Item[];
  selecionadoId: number | null;
  onSelecionar: (item: Item) => void;
  placeholder?: string;
}) {
  const [busca, setBusca] = useState("");
  const [aberto, setAberto] = useState(false);

  const selecionado = items.find((i) => i.id === selecionadoId) ?? null;

  const filtrados = useMemo(() => {
    const termo = busca.trim().toLocaleUpperCase("pt-BR");
    if (!termo) return items;
    return items.filter((i) => i.nome.toLocaleUpperCase("pt-BR").includes(termo));
  }, [busca, items]);

  if (selecionado && !aberto) {
    return (
      <div>
        <label className="block text-sm font-medium text-neutral-600 mb-1">{label}</label>
        <button
          type="button"
          onClick={() => {
            setBusca("");
            setAberto(true);
          }}
          className="w-full flex items-center justify-between rounded-lg border border-neutral-300 bg-white px-4 py-3 text-left text-base"
        >
          <span className="font-medium">{selecionado.nome}</span>
          <span className="text-sm text-[#5F0040] underline">trocar</span>
        </button>
      </div>
    );
  }

  return (
    <div>
      <label className="block text-sm font-medium text-neutral-600 mb-1">{label}</label>
      <input
        type="text"
        value={busca}
        onChange={(e) => setBusca(e.target.value)}
        onFocus={() => setAberto(true)}
        placeholder={placeholder}
        autoComplete="off"
        className="w-full rounded-lg border border-neutral-300 px-4 py-3 text-base"
      />
      {aberto && (
        <ul className="mt-1 max-h-56 overflow-y-auto rounded-lg border border-neutral-300 bg-white shadow-sm">
          {filtrados.length === 0 && (
            <li className="px-4 py-3 text-sm text-neutral-400">Nenhum resultado</li>
          )}
          {filtrados.map((item) => (
            <li key={item.id}>
              <button
                type="button"
                onClick={() => {
                  onSelecionar(item);
                  setAberto(false);
                  setBusca("");
                }}
                className="w-full px-4 py-3 text-left text-base hover:bg-neutral-50"
              >
                {item.nome}
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
