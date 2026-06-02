const mono = "'IBM Plex Mono', ui-monospace, monospace"

export function Footer() {
  const year = new Date().getFullYear()
  return (
    <div
      style={{ fontFamily: mono }}
      className='mx-auto flex max-w-7xl items-center justify-between px-4 py-5 lg:px-8'
    >
      <span className='text-[11px] tracking-[1px] text-[#3f5249]'>
        © {year} GRID CARBON CLOCK
      </span>
      <div className='flex items-center gap-5'>
        <a
          href='https://watttime.org'
          target='_blank'
          rel='noopener noreferrer'
          className='text-[11px] tracking-[1px] text-[#5f7a6c] transition-colors hover:text-[#e8efe9]'
        >
          WATTTIME
        </a>
        <a
          href='https://github.com/wardbox/grid-carbon-clock'
          target='_blank'
          rel='noopener noreferrer'
          className='text-[11px] tracking-[1px] text-[#5f7a6c] transition-colors hover:text-[#e8efe9]'
        >
          GITHUB
        </a>
      </div>
    </div>
  )
}

export default Footer
