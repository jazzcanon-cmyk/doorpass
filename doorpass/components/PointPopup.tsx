'use client'
import { useEffect, useState } from 'react'

interface PointPopupProps {
  points: number
  action: string
  totalPoints: number
  onClose: () => void
}

export function PointPopup({ points, action, totalPoints, onClose }: PointPopupProps) {
  const [visible, setVisible] = useState(false)

  useEffect(() => {
    const t1 = setTimeout(() => setVisible(true), 50)
    const t2 = setTimeout(() => {
      setVisible(false)
      setTimeout(onClose, 400)
    }, 2500)
    return () => { clearTimeout(t1); clearTimeout(t2) }
  }, [onClose])

  return (
    <div
      style={{
        position: 'fixed',
        inset: 0,
        zIndex: 99999,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        pointerEvents: 'none',
      }}
    >
      <div
        style={{
          transform: visible ? 'translateY(0) scale(1)' : 'translateY(40px) scale(0.8)',
          opacity: visible ? 1 : 0,
          transition: 'all 0.4s cubic-bezier(0.34, 1.56, 0.64, 1)',
          background: 'linear-gradient(135deg, #f59e0b, #ef4444)',
          borderRadius: '24px',
          padding: '28px 40px',
          textAlign: 'center',
          boxShadow: '0 20px 60px rgba(0,0,0,0.5), 0 0 40px rgba(245,158,11,0.3)',
          minWidth: '200px',
        }}
      >
        <div style={{ fontSize: '48px', marginBottom: '8px', lineHeight: 1 }}>🎉</div>

        <div
          style={{
            fontSize: '48px',
            fontWeight: 900,
            color: 'white',
            lineHeight: 1,
            marginBottom: '6px',
            textShadow: '0 2px 8px rgba(0,0,0,0.3)',
          }}
        >
          +{points}P
        </div>

        <div
          style={{
            fontSize: '14px',
            color: 'rgba(255,255,255,0.85)',
            marginBottom: '12px',
            fontWeight: 500,
          }}
        >
          {action}
        </div>

        <div style={{ height: '1px', background: 'rgba(255,255,255,0.2)', margin: '0 0 10px' }} />

        <div style={{ fontSize: '13px', color: 'rgba(255,255,255,0.8)' }}>
          누적{' '}
          <span style={{ fontWeight: 700, color: 'white', fontSize: '16px' }}>
            {totalPoints.toLocaleString()}P
          </span>
        </div>
      </div>
    </div>
  )
}
