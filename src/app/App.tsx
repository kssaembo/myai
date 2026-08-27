import '@/styles/global.css'

const fallbackAppName = 'Personal AI Knowledge OS'

export function App() {
  const appName = import.meta.env.VITE_APP_NAME ?? fallbackAppName

  return (
    <main className="foundation" aria-labelledby="app-title">
      <h1 id="app-title">{appName}</h1>
      <p>Repository foundation is ready.</p>
    </main>
  )
}

export default App
