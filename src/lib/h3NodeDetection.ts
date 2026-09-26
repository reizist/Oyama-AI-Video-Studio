import type { ObjectInfo } from "./comfyInfo"

export function findH3PreviewOverrideNode(info: ObjectInfo) {
  return Object.keys(info).find((name) => name === 'MiniMaxH3PreviewOverrideCS')
    ?? Object.keys(info).find((name) => /minimax.*h3.*preview.*override/i.test(name))
}

export function findH3ParallelAttentionNode(info: ObjectInfo) {
  return Object.keys(info).find((name) => /minimax.*h3.*attention.*parallel/i.test(name))
    ?? Object.keys(info).find((name) => /h3.*parallel.*attention/i.test(name))
}

export function findSolAttentionNode(info: ObjectInfo) {
  return Object.keys(info).find((name) => name === 'SolAttnH3')
    ?? Object.keys(info).find((name) => /sol.*attn.*h3/i.test(name))
}

export function findSolCompatibleCacheNode(info: ObjectInfo) {
  return Object.keys(info).find((name) => name === 'MiniMaxH3Cache')
}

