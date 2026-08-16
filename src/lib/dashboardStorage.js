import { supabase } from "./supabaseClient";

/*
 * Todo o estado do dashboard (meta global, período, lançamentos de produção
 * de todas as linhas, OEE, roteiro da qualidade, supervisor, tema, linha
 * ativa) é salvo como pares chave/valor (JSON) numa única tabela:
 *
 *   dashboard_kv (chave text primary key, valor jsonb, atualizado_em timestamptz)
 *
 * Veja schema.sql para o script de criação da tabela + policies de RLS.
 * Essa abordagem simples evita ter que desenhar um schema relacional
 * completo agora — cada "useState" do dashboard vira uma linha na tabela.
 * Se no futuro fizer sentido normalizar (ex.: uma tabela própria para os
 * lançamentos de produção, com filtros/relatórios via SQL), dá pra migrar
 * gradualmente sem quebrar o restante.
 */

const TABELA = "dashboard_kv";

/** Carrega todas as chaves de uma vez (uma única consulta ao Supabase).
 * Retorna um objeto { chave: valor, ... } ou `null` se a consulta falhar
 * (ex.: Supabase não configurado, offline, tabela ainda não criada). */
export async function kvGetAll() {
  try {
    const { data, error } = await supabase.from(TABELA).select("chave, valor");
    if (error) {
      // eslint-disable-next-line no-console
      console.error("[Supabase] Erro ao carregar dashboard_kv:", error.message);
      return null;
    }
    const mapa = {};
    (data || []).forEach((linha) => { mapa[linha.chave] = linha.valor; });
    return mapa;
  } catch (e) {
    // eslint-disable-next-line no-console
    console.error("[Supabase] Falha de conexão ao carregar dashboard_kv:", e.message);
    return null;
  }
}

/** Salva (upsert) uma chave. Fire-and-forget: erros só vão pro console,
 * não travam a interface — o dashboard continua utilizável offline/local. */
export async function kvSet(chave, valor) {
  try {
    const { error } = await supabase
      .from(TABELA)
      .upsert({ chave, valor, atualizado_em: new Date().toISOString() }, { onConflict: "chave" });
    if (error) {
      // eslint-disable-next-line no-console
      console.error(`[Supabase] Erro ao salvar "${chave}":`, error.message);
    }
  } catch (e) {
    // eslint-disable-next-line no-console
    console.error(`[Supabase] Falha de conexão ao salvar "${chave}":`, e.message);
  }
}
