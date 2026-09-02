'use client'

import type { ReactNode } from 'react'

type Block =
  | { type: 'h1' | 'h2' | 'h3'; text: string }
  | { type: 'p'; text: string }
  | { type: 'ul'; items: string[] }

const inlineFormat = (text: string): ReactNode[] => {
  const parts: ReactNode[] = []
  const pattern = /(\*\*[^*]+\*\*|`[^`]+`)/g
  let last = 0
  let match: RegExpExecArray | null
  let key = 0
  while ((match = pattern.exec(text)) !== null) {
    if (match.index > last) {
      parts.push(text.slice(last, match.index))
    }
    const token = match[0]
    if (token.startsWith('**')) {
      parts.push(<strong key={`b-${key++}`}>{token.slice(2, -2)}</strong>)
    } else {
      parts.push(
        <code key={`c-${key++}`} className="pack-md-code">
          {token.slice(1, -1)}
        </code>,
      )
    }
    last = match.index + token.length
  }
  if (last < text.length) parts.push(text.slice(last))
  return parts
}

const parseBlocks = (markdown: string): Block[] => {
  const lines = markdown.replace(/\r\n/g, '\n').split('\n')
  const blocks: Block[] = []
  let paragraph: string[] = []
  let listItems: string[] = []

  const flushParagraph = () => {
    if (!paragraph.length) return
    blocks.push({ type: 'p', text: paragraph.join(' ').trim() })
    paragraph = []
  }
  const flushList = () => {
    if (!listItems.length) return
    blocks.push({ type: 'ul', items: [...listItems] })
    listItems = []
  }

  for (const rawLine of lines) {
    const line = rawLine.trimEnd()
    const trimmed = line.trim()
    if (!trimmed) {
      flushParagraph()
      flushList()
      continue
    }
    if (trimmed.startsWith('### ')) {
      flushParagraph()
      flushList()
      blocks.push({ type: 'h3', text: trimmed.slice(4) })
      continue
    }
    if (trimmed.startsWith('## ')) {
      flushParagraph()
      flushList()
      blocks.push({ type: 'h2', text: trimmed.slice(3) })
      continue
    }
    if (trimmed.startsWith('# ')) {
      flushParagraph()
      flushList()
      blocks.push({ type: 'h1', text: trimmed.slice(2) })
      continue
    }
    if (trimmed.startsWith('- ') || trimmed.startsWith('* ')) {
      flushParagraph()
      listItems.push(trimmed.slice(2))
      continue
    }
    flushList()
    paragraph.push(trimmed)
  }
  flushParagraph()
  flushList()
  return blocks
}

/** Lightweight markdown preview for pack skill/style bodies (no extra deps). */
export const PackMarkdownPreview = ({ markdown }: { markdown: string }) => {
  const blocks = parseBlocks(markdown)
  if (!blocks.length) {
    return <p className="page-lede">This pack has no readable body yet.</p>
  }
  return (
    <div className="pack-md">
      {blocks.map((block, index) => {
        if (block.type === 'h1') return <h3 key={index}>{inlineFormat(block.text)}</h3>
        if (block.type === 'h2') return <h4 key={index}>{inlineFormat(block.text)}</h4>
        if (block.type === 'h3') return <h5 key={index}>{inlineFormat(block.text)}</h5>
        if (block.type === 'ul') {
          return (
            <ul key={index}>
              {block.items.map((item, itemIndex) => (
                <li key={itemIndex}>{inlineFormat(item)}</li>
              ))}
            </ul>
          )
        }
        return <p key={index}>{inlineFormat(block.text)}</p>
      })}
    </div>
  )
}
