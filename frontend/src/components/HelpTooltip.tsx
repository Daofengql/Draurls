import { useState } from 'react'
import { Box, IconButton, Popover, Typography, Dialog, DialogTitle, DialogContent, DialogActions, Button } from '@mui/material'
import HelpIcon from '@mui/icons-material/Help'
import CloseIcon from '@mui/icons-material/Close'

interface HelpTooltipProps {
  content: React.ReactNode
  className?: string
}

export function HelpTooltip({ content, className = '' }: HelpTooltipProps) {
  const [anchorEl, setAnchorEl] = useState<HTMLElement | null>(null)

  const handleOpen = (event: React.MouseEvent<HTMLElement>) => {
    setAnchorEl(event.currentTarget)
  }

  const handleClose = () => {
    setAnchorEl(null)
  }

  const open = Boolean(anchorEl)

  return (
    <Box className={className} sx={{ display: 'inline-block' }}>
      <IconButton
        size="small"
        onMouseEnter={handleOpen}
        onClick={handleOpen}
        sx={{ color: 'text.disabled', '&:hover': { color: 'text.secondary' } }}
      >
        <HelpIcon fontSize="small" />
      </IconButton>
      <Popover
        open={open}
        anchorEl={anchorEl}
        onClose={handleClose}
        anchorOrigin={{ vertical: 'bottom', horizontal: 'left' }}
        transformOrigin={{ vertical: 'top', horizontal: 'left' }}
        slotProps={{
          paper: {
            sx: {
              bgcolor: 'grey.800',
              color: 'white',
              p: 1.5,
              maxWidth: 280,
              borderRadius: 2,
              mt: 0.5,
              ml: 0.5,
            }
          }
        }}
        onMouseLeave={handleClose}
      >
        <Typography variant="caption" component="div">
          {content}
        </Typography>
      </Popover>
    </Box>
  )
}

interface HelpModalProps {
  isOpen: boolean
  onClose: () => void
  title: string
  children: React.ReactNode
}

export function HelpModal({ isOpen, onClose, title, children }: HelpModalProps) {
  return (
    <Dialog
      open={isOpen}
      onClose={onClose}
      maxWidth="md"
      fullWidth
      PaperProps={{ sx: { maxHeight: '80vh' } }}
    >
      <DialogTitle sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <Typography variant="h6" component="span">
          {title}
        </Typography>
        <IconButton onClick={onClose} size="small" sx={{ color: 'text.disabled' }}>
          <CloseIcon />
        </IconButton>
      </DialogTitle>
      <DialogContent dividers>
        <Typography variant="body2" component="div">
          {children}
        </Typography>
      </DialogContent>
      <DialogActions>
        <Button onClick={onClose}>关闭</Button>
      </DialogActions>
    </Dialog>
  )
}
