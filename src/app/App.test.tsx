import { render, screen } from '@testing-library/react'
import { describe, expect, it } from 'vitest'

import { App } from './App'

describe('App', () => {
  it('renders the repository foundation', () => {
    render(<App />)

    expect(screen.getByRole('heading', { name: 'Personal AI Knowledge OS' })).toBeInTheDocument()
  })
})
