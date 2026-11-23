import {
  useEffect,
  useId,
  useRef,
  type ButtonHTMLAttributes,
  type InputHTMLAttributes,
  type ReactNode,
  type SelectHTMLAttributes,
  type TextareaHTMLAttributes,
} from 'react'
import { dayOfMonth, initials, monthShort } from '../lib/format.ts'

function cx(...classes: (string | false | null | undefined)[]) {
  return classes.filter(Boolean).join(' ')
}

export function Card({ children, className, as: Tag = 'div' }: { children: ReactNode; className?: string; as?: 'div' | 'section' | 'li' }) {
  return <Tag className={cx('bg-white border border-line rounded-2xl', className)}>{children}</Tag>
}

export type Tone = 'brand' | 'amber' | 'neutral' | 'danger' | 'solidAmber'
const TONE: Record<Tone, string> = {
  brand: 'bg-brand-light text-brand',
  amber: 'bg-amber-soft text-amber-ink',
  neutral: 'bg-chip text-chip-ink',
  danger: 'bg-danger-soft text-danger',
  solidAmber: 'bg-amber text-ink',
}

export function Badge({ tone = 'neutral', children, className }: { tone?: Tone; children: ReactNode; className?: string }) {
  return (
    <span
      className={cx('inline-flex items-center text-xs font-semibold px-2.5 py-1 rounded-full whitespace-nowrap', TONE[tone], className)}
    >
      {children}
    </span>
  )
}

type Variant = 'primary' | 'secondary' | 'ghost' | 'danger' | 'dashed'
const VARIANT: Record<Variant, string> = {
  primary: 'bg-brand text-white hover:bg-brand-dark border border-transparent',
  secondary: 'bg-white text-ink border border-line hover:bg-ground',
  ghost: 'bg-transparent text-brand hover:bg-brand-light border border-transparent',
  danger: 'bg-white text-danger border border-line hover:bg-danger-soft',
  dashed: 'bg-transparent text-ink border-[1.5px] border-dashed border-[#B9B5AA] hover:bg-white',
}

export function Button({ variant = 'primary', className, ...props }: ButtonHTMLAttributes<HTMLButtonElement> & { variant?: Variant }) {
  return (
    <button
      type="button"
      {...props}
      className={cx(
        'min-h-[44px] px-4 rounded-xl text-sm font-semibold inline-flex items-center justify-center gap-2 transition-colors disabled:opacity-50 disabled:cursor-not-allowed',
        VARIANT[variant],
        className,
      )}
    />
  )
}

export function Segmented<T extends string>({
  value,
  options,
  onChange,
  label,
}: {
  value: T
  options: { value: T; label: string }[]
  onChange: (v: T) => void
  label: string
}) {
  return (
    <div
      role="group"
      aria-label={label}
      className="grid bg-chip rounded-xl p-1"
      style={{ gridTemplateColumns: `repeat(${options.length}, minmax(0, 1fr))` }}
    >
      {options.map((o) => (
        <button
          key={o.value}
          type="button"
          aria-pressed={value === o.value}
          onClick={() => onChange(o.value)}
          className={cx(
            'h-9 rounded-[9px] text-sm',
            value === o.value ? 'bg-white font-semibold text-ink shadow-sm' : 'font-medium text-muted',
          )}
        >
          {o.label}
        </button>
      ))}
    </div>
  )
}

export function Chips<T extends string>({
  value,
  options,
  onChange,
  label,
}: {
  value: T
  options: { value: T; label: string }[]
  onChange: (v: T) => void
  label: string
}) {
  return (
    <div role="group" aria-label={label} className="flex gap-2 overflow-x-auto pb-1">
      {options.map((o) => (
        <button
          key={o.value}
          type="button"
          aria-pressed={value === o.value}
          onClick={() => onChange(o.value)}
          className={cx(
            'h-9 px-4 rounded-full text-sm whitespace-nowrap',
            value === o.value ? 'bg-ink text-white font-semibold' : 'bg-white border border-line text-ink font-medium',
          )}
        >
          {o.label}
        </button>
      ))}
    </div>
  )
}

export function Modal({ open, title, onClose, children }: { open: boolean; title: string; onClose: () => void; children: ReactNode }) {
  const titleId = useId()
  const panel = useRef<HTMLDivElement>(null)
  useEffect(() => {
    if (!open) return
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose()
    }
    document.addEventListener('keydown', onKey)
    panel.current?.querySelector<HTMLElement>('input, select, textarea, button')?.focus()
    return () => document.removeEventListener('keydown', onKey)
  }, [open, onClose])
  if (!open) return null
  return (
    // Clicking the backdrop closes it; keyboard users close it with Escape.
    <div
      role="presentation"
      className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-ink/40"
      onMouseDown={(e) => {
        if (e.target === e.currentTarget) onClose()
      }}
    >
      <div
        ref={panel}
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        className="bg-ground w-full sm:max-w-md max-h-[90vh] overflow-y-auto rounded-t-3xl sm:rounded-3xl p-5 shadow-xl"
      >
        <div className="flex items-center justify-between mb-4">
          <h2 id={titleId} className="text-lg font-bold">
            {title}
          </h2>
          <button
            type="button"
            aria-label="Close"
            onClick={onClose}
            className="w-11 h-11 rounded-full hover:bg-chip flex items-center justify-center"
          >
            <Icon name="close" />
          </button>
        </div>
        {children}
      </div>
    </div>
  )
}

export function Field({ label, children, hint }: { label: string; children: (id: string) => ReactNode; hint?: string }) {
  const id = useId()
  return (
    <div className="flex flex-col gap-1">
      <label htmlFor={id} className="text-sm font-medium text-ink">
        {label}
      </label>
      {children(id)}
      {hint && <p className="text-xs text-muted">{hint}</p>}
    </div>
  )
}

const inputClass =
  'w-full min-h-[44px] border border-line rounded-xl px-3 py-2 text-[15px] bg-white focus:outline-none focus:ring-2 focus:ring-brand/40'

export function TextInput(props: InputHTMLAttributes<HTMLInputElement>) {
  return <input {...props} className={cx(inputClass, props.className)} />
}

export function TextArea(props: TextareaHTMLAttributes<HTMLTextAreaElement>) {
  return <textarea rows={3} {...props} className={cx(inputClass, props.className)} />
}

export function Select(props: SelectHTMLAttributes<HTMLSelectElement>) {
  return <select {...props} className={cx(inputClass, props.className)} />
}

export function Checkbox({
  label,
  checked,
  onChange,
  hint,
}: {
  label: string
  checked: boolean
  onChange: (v: boolean) => void
  hint?: string
}) {
  return (
    <label className="flex items-center gap-3 min-h-[44px]">
      <span className="flex-1 flex flex-col">
        <span className="text-[15px] font-medium">{label}</span>
        {hint && <span className="text-xs text-muted">{hint}</span>}
      </span>
      <input type="checkbox" checked={checked} onChange={(e) => onChange(e.target.checked)} className="w-5 h-5 accent-brand" />
    </label>
  )
}

export function FormError({ error }: { error: unknown }) {
  if (!error) return null
  return (
    <p role="alert" className="text-sm text-danger">
      {error instanceof Error ? error.message : 'Something went wrong'}
    </p>
  )
}

export function EmptyState({ children }: { children: ReactNode }) {
  return <p className="text-sm text-muted bg-white border border-dashed border-line rounded-2xl p-5 text-center">{children}</p>
}

export function Loading() {
  return <p className="text-sm text-muted">Loading…</p>
}

export function LoadError({ what = 'this' }: { what?: string }) {
  return (
    <p role="alert" className="text-sm text-danger">
      Couldn't load {what}. Try again.
    </p>
  )
}

export function DateTile({ iso }: { iso: string }) {
  return (
    <div
      className="w-[52px] h-14 rounded-xl bg-brand-light flex flex-col items-center justify-center flex-none text-brand"
      aria-hidden="true"
    >
      <span className="text-[11px] font-semibold">{monthShort(iso)}</span>
      <span className="font-display text-xl font-bold leading-none">{dayOfMonth(iso)}</span>
    </div>
  )
}

const AVATAR_TONES = ['bg-brand-light text-brand', 'bg-amber-soft text-amber-ink', 'bg-chip text-chip-ink']
export function Avatar({
  name,
  index = 0,
  size = 40,
  photoUrl,
}: {
  name: string
  index?: number
  size?: number
  photoUrl?: string | null
}) {
  if (photoUrl) return <img src={photoUrl} alt="" className="rounded-full object-cover flex-none" style={{ width: size, height: size }} />
  return (
    <span
      aria-hidden="true"
      className={cx(
        'rounded-full flex items-center justify-center font-semibold flex-none text-[13px] border-2 border-white',
        AVATAR_TONES[index % AVATAR_TONES.length],
      )}
      style={{ width: size, height: size }}
    >
      {initials(name)}
    </span>
  )
}

export function SectionHeader({ title, action }: { title: string; action?: ReactNode }) {
  return (
    <div className="flex justify-between items-baseline">
      <h2 className="text-lg font-bold">{title}</h2>
      {action}
    </div>
  )
}

export function Stat({ value, label }: { value: ReactNode; label: string }) {
  return (
    <Card className="p-3 flex flex-col gap-0.5 rounded-[14px]">
      <span className="font-display text-xl font-bold">{value}</span>
      <span className="text-xs text-muted">{label}</span>
    </Card>
  )
}

export function Divided({ children }: { children: ReactNode[] }) {
  return (
    <>
      {children.map((c, i) => (
        <div key={i}>
          {i > 0 && <div className="h-px bg-divider mx-3.5" />}
          {c}
        </div>
      ))}
    </>
  )
}

const PATHS: Record<string, ReactNode> = {
  home: <path d="M3 10.5 12 3l9 7.5V20a1 1 0 0 1-1 1h-5v-6H9v6H4a1 1 0 0 1-1-1z" />,
  people: (
    <>
      <circle cx="9" cy="8" r="3.5" />
      <path d="M2.5 20c0-3.6 2.9-6 6.5-6s6.5 2.4 6.5 6" />
      <circle cx="17" cy="9" r="2.5" />
      <path d="M16.5 14.2c2.9.3 5 2.4 5 5.8" />
    </>
  ),
  gift: (
    <>
      <rect x="3" y="8" width="18" height="4" rx="1" />
      <path d="M5 12v8a1 1 0 0 0 1 1h12a1 1 0 0 0 1-1v-8" />
      <path d="M12 8v13" />
      <path d="M12 8C10.5 4.5 6.5 4 6.5 6.3 6.5 8 10 8 12 8zm0 0c1.5-3.5 5.5-4 5.5-1.7C17.5 8 14 8 12 8z" />
    </>
  ),
  sparkle: (
    <>
      <path d="M11 3l1.8 5.2L18 10l-5.2 1.8L11 17l-1.8-5.2L4 10l5.2-1.8z" />
      <path d="M19 15l.8 2.2L22 18l-2.2.8L19 21l-.8-2.2L16 18l2.2-.8z" />
    </>
  ),
  plus: <path d="M12 5v14M5 12h14" />,
  camera: (
    <>
      <path d="M4 8h3l2-3h6l2 3h3a1 1 0 0 1 1 1v10a1 1 0 0 1-1 1H4a1 1 0 0 1-1-1V9a1 1 0 0 1 1-1z" />
      <circle cx="12" cy="13.5" r="3.5" />
    </>
  ),
  close: <path d="M6 6l12 12M18 6 6 18" />,
  back: <path d="m15 6-6 6 6 6" />,
  chevron: <path d="m9 6 6 6-6 6" />,
  down: <path d="m6 9 6 6 6-6" />,
  search: (
    <>
      <circle cx="11" cy="11" r="7" />
      <path d="m20 20-3.5-3.5" />
    </>
  ),
  given: <path d="M7 17 17 7M17 7H9M17 7v8" />,
  received: <path d="M17 7 7 17M7 17h8M7 17V9" />,
  edit: <path d="M4 20h4L19 9l-4-4L4 16z" />,
  info: (
    <>
      <circle cx="12" cy="12" r="9" />
      <path d="M12 8v4M12 16h.01" />
    </>
  ),
  lock: (
    <>
      <rect x="5" y="11" width="14" height="10" rx="2" />
      <path d="M8 11V7a4 4 0 0 1 8 0v4" />
    </>
  ),
  link: (
    <>
      <path d="M10 14a4 4 0 0 0 5.7 0l3-3a4 4 0 0 0-5.7-5.7l-1 1" />
      <path d="M14 10a4 4 0 0 0-5.7 0l-3 3a4 4 0 0 0 5.7 5.7l1-1" />
    </>
  ),
  user: (
    <>
      <circle cx="12" cy="8" r="4" />
      <path d="M4 21c0-4 3.6-7 8-7s8 3 8 7" />
    </>
  ),
  eye: (
    <>
      <path d="M2 12s3.6-7 10-7 10 7 10 7-3.6 7-10 7S2 12 2 12z" />
      <circle cx="12" cy="12" r="3" />
    </>
  ),
}

export function Icon({ name, size = 20, label }: { name: keyof typeof PATHS; size?: number; label?: string }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={1.8}
      strokeLinecap="round"
      strokeLinejoin="round"
      {...(label ? { role: 'img', 'aria-label': label } : { 'aria-hidden': true })}
    >
      {PATHS[name]}
    </svg>
  )
}

export { cx }
