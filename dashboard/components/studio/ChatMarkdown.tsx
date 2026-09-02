'use client'

import Link from 'next/link'
import type { ReactNode } from 'react'
import { parseMarkdown, type MdInline } from '../../lib/simple-markdown'

const renderInlines = (inlines: MdInline[]): ReactNode =>
  inlines.map((part, index) => {
    if (part.type === 'strong') return <strong key={index}>{part.value}</strong>
    if (part.type === 'em') return <em key={index}>{part.value}</em>
    if (part.type === 'code') return <code key={index}>{part.value}</code>
    if (part.type === 'link') {
      return (
        <Link key={index} className="chat-md-link" href={part.href}>
          {part.value}
        </Link>
      )
    }
    return <span key={index}>{part.value}</span>
  })

/** ADR-0019 narration: markdown in the assistant bubble, never raw HTML. */
export const ChatMarkdown = ({ content }: { content: string }) => {
  const blocks = parseMarkdown(content)
  if (blocks.length === 0) return null
  return (
    <div className="chat-md">
      {blocks.map((block, index) => {
        if (block.type === 'h2') return <h3 key={index}>{renderInlines(block.inlines)}</h3>
        if (block.type === 'h3') return <h4 key={index}>{renderInlines(block.inlines)}</h4>
        if (block.type === 'ul') {
          return (
            <ul key={index}>
              {block.items.map((item, itemIndex) => (
                <li key={itemIndex}>{renderInlines(item)}</li>
              ))}
            </ul>
          )
        }
        if (block.type === 'ol') {
          return (
            <ol key={index}>
              {block.items.map((item, itemIndex) => (
                <li key={itemIndex}>{renderInlines(item)}</li>
              ))}
            </ol>
          )
        }
        if (block.type === 'table') {
          return (
            <div key={index} className="chat-md-table-wrap">
              <table>
                <thead>
                  <tr>
                    {block.headers.map((cell, cellIndex) => (
                      <th key={cellIndex}>{renderInlines(cell)}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {block.rows.map((row, rowIndex) => (
                    <tr key={rowIndex}>
                      {row.map((cell, cellIndex) => (
                        <td key={cellIndex}>{renderInlines(cell)}</td>
                      ))}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )
        }
        if (block.type === 'pre') {
          return (
            <pre key={index}>
              <code>{block.value}</code>
            </pre>
          )
        }
        if (block.type === 'blockquote') {
          return <blockquote key={index}>{renderInlines(block.inlines)}</blockquote>
        }
        if (block.type === 'hr') return <hr key={index} />
        if (block.type === 'p') {
          return <p key={index}>{renderInlines(block.inlines)}</p>
        }
        return null
      })}
    </div>
  )
}
