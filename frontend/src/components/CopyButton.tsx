import { useState } from 'react'
import { Button, TextField, Stack, IconButton, Tooltip } from '@mui/material'
import ContentCopyIcon from '@mui/icons-material/ContentCopy'
import CheckIcon from '@mui/icons-material/Check'

interface CopyButtonProps {
  text: string
  className?: string
  children?: React.ReactNode
}

export default function CopyButton({ text, children }: CopyButtonProps) {
  const [copied, setCopied] = useState(false)

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(text)
      setCopied(true)
      setTimeout(() => setCopied(false), 2000)
    } catch (err) {
      console.error('复制失败:', err)
    }
  }

  return (
    <Tooltip title={copied ? '已复制' : '复制'}>
      <span onClick={(e) => { e.stopPropagation(); handleCopy() }}>
        {children}
      </span>
    </Tooltip>
  )
}

export function CopyInput({ value, readOnly = true }: { value: string; readOnly?: boolean }) {
  const [copied, setCopied] = useState(false)

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(value)
      setCopied(true)
      setTimeout(() => setCopied(false), 2000)
    } catch (err) {
      console.error('复制失败:', err)
    }
  }

  return (
    <Stack direction="row" spacing={1} sx={{ width: '100%' }}>
      <TextField
        type="text"
        value={value}
        InputProps={{
          readOnly: readOnly,
        }}
        fullWidth
        size="small"
        slotProps={{
          input: {
            sx: { fontFamily: 'monospace', fontSize: '0.875rem' }
          }
        }}
      />
      <Button
        variant="outlined"
        onClick={handleCopy}
        startIcon={copied ? <CheckIcon /> : <ContentCopyIcon />}
        sx={{ minWidth: 80 }}
        color={copied ? 'success' : 'primary'}
      >
        {copied ? '已复制' : '复制'}
      </Button>
    </Stack>
  )
}

export function CopyIconButton({ text }: { text: string }) {
  const [copied, setCopied] = useState(false)

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(text)
      setCopied(true)
      setTimeout(() => setCopied(false), 2000)
    } catch (err) {
      console.error('复制失败:', err)
    }
  }

  return (
    <Tooltip title={copied ? '已复制' : '复制'}>
      <IconButton
        size="small"
        onClick={handleCopy}
        color={copied ? 'success' : 'default'}
      >
        {copied ? <CheckIcon fontSize="small" /> : <ContentCopyIcon fontSize="small" />}
      </IconButton>
    </Tooltip>
  )
}
