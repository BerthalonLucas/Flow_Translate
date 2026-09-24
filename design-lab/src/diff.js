/** Tokenize into words + whitespace/punctuation runs so joining tokens reproduces the text exactly. */
export function tokenize(s) {
  return s.match(/[\p{L}\p{N}\p{M}'’-]+|\s+|[^\s\p{L}\p{N}\p{M}]/gu) ?? [];
}
/**
 * LCS word diff. Returns ops [{type:'eq'|'del'|'ins', text}], merged into runs.
 * O(n·m) memory/time — fine for selections up to a few thousand tokens.
 */
export function wordDiff(a, b) {
  const A = tokenize(a), B = tokenize(b), n = A.length, m = B.length;
  // trim common prefix/suffix first (cheap, huge win for small edits)
  let p = 0; while (p < n && p < m && A[p] === B[p]) p++;
  let s = 0; while (s < n - p && s < m - p && A[n - 1 - s] === B[m - 1 - s]) s++;
  const a2 = A.slice(p, n - s), b2 = B.slice(p, m - s), N = a2.length, M = b2.length;
  const L = Array.from({ length: N + 1 }, () => new Uint32Array(M + 1));
  for (let i = N - 1; i >= 0; i--)
    for (let j = M - 1; j >= 0; j--)
      L[i][j] = a2[i] === b2[j] ? L[i + 1][j + 1] + 1 : Math.max(L[i + 1][j], L[i][j + 1]);
  const ops = [];
  const push = (type, text) => { const last = ops[ops.length - 1]; if (last && last.type === type) last.text += text; else ops.push({ type, text }); };
  A.slice(0, p).forEach(t => push('eq', t));
  let i = 0, j = 0;
  while (i < N && j < M) {
    if (a2[i] === b2[j]) { push('eq', a2[i]); i++; j++; }
    else if (L[i + 1][j] >= L[i][j + 1]) push('del', a2[i++]);
    else push('ins', b2[j++]);
  }
  while (i < N) push('del', a2[i++]);
  while (j < M) push('ins', b2[j++]);
  A.slice(n - s).forEach(t => push('eq', t));
  return ops;
}
