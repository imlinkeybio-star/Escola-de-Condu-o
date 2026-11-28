/**
 * Translates any technical/backend/Firebase/API error into plain,
 * respectful language that everyday driving school students understand.
 * Never exposes JSON dumps, authInfo, operationType, HTTP status codes,
 * or programmer stack traces in the UI.
 */
export function toUserFriendlyError(
  err: unknown,
  fallback = 'Não foi possível concluir esta operação. Tenta novamente dentro de instantes.'
): string {
  const raw =
    err instanceof Error
      ? err.message
      : typeof err === 'string'
        ? err
        : '';

  const trimmed = raw.trim();
  if (!trimmed) return fallback;

  // 1. Parse JSON-serialized errors (e.g. FirestoreErrorInfo or Google/OpenAI JSON error payloads)
  if (trimmed.startsWith('{') && trimmed.endsWith('}')) {
    try {
      const parsed = JSON.parse(trimmed) as {
        error?: string | { message?: string; code?: number; status?: string };
        operationType?: string;
        message?: string;
      };
      const innerMsg =
        typeof parsed.error === 'string'
          ? parsed.error
          : parsed.error?.message || parsed.message || '';
      const innerCode =
        typeof parsed.error === 'object' && parsed.error !== null
          ? parsed.error.code
          : undefined;
      const innerStatus =
        typeof parsed.error === 'object' && parsed.error !== null
          ? parsed.error.status
          : undefined;

      if (
        innerCode === 503 ||
        innerStatus === 'UNAVAILABLE' ||
        /high demand|temporarily unavailable/i.test(innerMsg)
      ) {
        return 'O sistema inteligente está com muita procura neste momento. Tenta novamente dentro de alguns segundos.';
      }
      if (
        innerCode === 429 ||
        /quota|rate limit|resource_exhausted/i.test(innerMsg)
      ) {
        return 'Muitos pedidos seguidos neste momento. Aguarda alguns segundos e tenta novamente.';
      }
      if (/missing or insufficient permissions|permission-denied/i.test(innerMsg)) {
        return 'Não foi possível concluir esta ação agora. Atualiza a página ou verifica se a tua sessão está ativa.';
      }
      if (innerMsg && !innerMsg.startsWith('{')) {
        return toUserFriendlyError(innerMsg, fallback);
      }
      return fallback;
    } catch {
      return fallback;
    }
  }

  const lower = trimmed.toLowerCase();

  // 2. Network / Offline / Timeout issues
  if (
    lower.includes('client is offline') ||
    lower.includes('network-request-failed') ||
    lower.includes('failed to fetch') ||
    lower.includes('fetch failed') ||
    lower.includes('networkerror') ||
    lower.includes('err_internet_disconnected') ||
    lower.includes('econnreset') ||
    lower.includes('etimedout') ||
    lower.includes('enotfound')
  ) {
    return 'Sem ligação à internet neste momento. Verifica a tua rede e tenta novamente.';
  }

  // 3. Model overload / 503 / 429
  if (
    lower.includes('high demand') ||
    lower.includes('unavailable') ||
    lower.includes('"code":503') ||
    lower.includes('503') ||
    lower.includes('overloaded') ||
    lower.includes('internal server error')
  ) {
    return 'O sistema inteligente está com muita procura neste momento. Tenta novamente dentro de alguns segundos.';
  }
  if (
    lower.includes('quota') ||
    lower.includes('rate limit') ||
    lower.includes('too-many-requests') ||
    lower.includes('resource_exhausted') ||
    lower.includes('429')
  ) {
    return 'Demasiados pedidos seguidos. Aguarda alguns segundos e tenta novamente.';
  }

  // 4. Permissions & Auth codes
  if (
    lower.includes('missing or insufficient permissions') ||
    lower.includes('permission-denied') ||
    lower.includes('insufficient permissions')
  ) {
    return 'Esta ação não pôde ser concluída com a sessão atual. Atualiza a página e tenta novamente.';
  }
  if (
    lower.includes('auth/wrong-password') ||
    lower.includes('auth/invalid-credential')
  ) {
    return 'As credenciais inseridas estão incorretas. Confirma e tenta novamente.';
  }
  if (lower.includes('auth/user-not-found')) {
    return 'Não encontrámos nenhuma conta registada com esse email.';
  }
  if (lower.includes('auth/email-already-in-use')) {
    return 'Este email já está a ser utilizado por outra conta.';
  }
  if (lower.includes('auth/weak-password')) {
    return 'A palavra-passe é demasiado simples. Escolhe uma com pelo menos 6 caracteres.';
  }
  if (lower.includes('auth/requires-recent-login')) {
    return 'Por segurança, termina a sessão e volta a entrar antes de fazer esta alteração.';
  }
  if (lower.includes('auth/popup-closed-by-user')) {
    return 'A janela de confirmação do Google foi fechada antes de concluir.';
  }
  if (lower.includes('auth/')) {
    return 'Não foi possível validar a tua conta. Tenta iniciar sessão novamente.';
  }

  // 5. Generic technical terms filter (FirebaseError, AbortError, JSON braces, TypeError, stack traces)
  if (
    trimmed.includes('{') ||
    trimmed.includes('}') ||
    lower.startsWith('firebaseerror:') ||
    lower.includes('authinfo') ||
    lower.includes('operationtype') ||
    lower.includes('cannot read properties') ||
    lower.includes('unexpected token') ||
    lower.includes('failed-precondition') ||
    lower.includes('api_key') ||
    lower.includes('status http')
  ) {
    return fallback;
  }

  return trimmed;
}
