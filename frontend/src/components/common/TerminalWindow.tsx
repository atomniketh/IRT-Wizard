import { useEffect, useRef } from 'react'
import { clsx } from 'clsx'

interface TerminalWindowProps {
  title?: string
  logs: string[]
  className?: string
  maxHeight?: string
}

export function TerminalWindow({
  title = 'Analysis Output',
  logs,
  className,
  maxHeight = '300px',
}: TerminalWindowProps) {
  const scrollRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight
    }
  }, [logs])

  return (
    <div className={clsx('rounded-lg overflow-hidden shadow-lg', className)}>
      {/* macOS-style title bar */}
      <div className="bg-gray-700 px-4 py-2 flex items-center space-x-2">
        {/* Traffic light buttons */}
        <div className="flex space-x-2">
          <div className="w-3 h-3 rounded-full bg-red-500" />
          <div className="w-3 h-3 rounded-full bg-yellow-500" />
          <div className="w-3 h-3 rounded-full bg-green-500" />
        </div>
        {/* Title */}
        <div className="flex-1 text-center">
          <span className="text-gray-300 text-sm font-medium">{title}</span>
        </div>
        {/* Spacer for symmetry */}
        <div className="w-14" />
      </div>

      {/* Terminal content */}
      <div
        ref={scrollRef}
        className="bg-gray-900 p-4 font-mono text-sm overflow-y-auto"
        style={{ maxHeight }}
      >
        {logs.length === 0 ? (
          <div className="text-gray-500">Waiting for output...</div>
        ) : (
          logs.map((log, index) => (
            <div key={index} className="leading-relaxed">
              <LogLine text={log} />
            </div>
          ))
        )}
        {/* Blinking cursor */}
        <span className="inline-block w-2 h-4 bg-green-400 animate-pulse ml-1" />
      </div>
    </div>
  )
}

function LogLine({ text }: { text: string }) {
  const getLineColor = (line: string): string => {
    const lowerLine = line.toLowerCase()
    if (lowerLine.includes('error') || lowerLine.includes('failed')) {
      return 'text-red-400'
    }
    if (lowerLine.includes('warning') || lowerLine.includes('warn')) {
      return 'text-yellow-400'
    }
    if (lowerLine.includes('success') || lowerLine.includes('complete') || lowerLine.includes('done')) {
      return 'text-green-400'
    }
    if (lowerLine.includes('info') || lowerLine.startsWith('[info]') || lowerLine.startsWith('→')) {
      return 'text-blue-400'
    }
    if (lowerLine.startsWith('$') || lowerLine.startsWith('>')) {
      return 'text-purple-400'
    }
    return 'text-gray-300'
  }

  const formatTimestamp = (line: string): React.ReactNode => {
    const timestampMatch = line.match(/^\[(\d{2}:\d{2}:\d{2})\]/)
    if (timestampMatch) {
      const timestamp = timestampMatch[1]
      const rest = line.slice(timestampMatch[0].length)
      return (
        <>
          <span className="text-gray-500">[{timestamp}]</span>
          <span className={getLineColor(rest)}>{rest}</span>
        </>
      )
    }
    return <span className={getLineColor(text)}>{text}</span>
  }

  return formatTimestamp(text)
}
