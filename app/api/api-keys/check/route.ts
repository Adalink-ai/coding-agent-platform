import { NextRequest, NextResponse } from 'next/server'
import { getUserApiKey } from '@/lib/api-keys/user-keys'

type Provider = 'openai' | 'gemini' | 'cursor' | 'anthropic' | 'aigateway' | 'moonshot' | 'zai'

// Map agents to their required providers
const AGENT_PROVIDER_MAP: Record<string, Provider | null> = {
  claude: 'aigateway', // Claude uses Vercel AI Gateway
  codex: 'aigateway', // Codex uses Vercel AI Gateway
  copilot: null, // Copilot uses user's GitHub token from their account
  cursor: 'cursor',
  gemini: 'gemini',
  opencode: 'openai', // OpenCode provider is selected dynamically by model
}

// Check if a model is an Anthropic model
function isAnthropicModel(model: string): boolean {
  const anthropicPatterns = ['claude', 'sonnet', 'opus']
  const lowerModel = model.toLowerCase()
  return anthropicPatterns.some((pattern) => lowerModel.includes(pattern))
}

// Check if a model is an OpenAI model
function isOpenAIModel(model: string): boolean {
  const openaiPatterns = ['gpt', 'openai']
  const lowerModel = model.toLowerCase()
  return openaiPatterns.some((pattern) => lowerModel.includes(pattern))
}

// Check if a model is a Gemini model
function isGeminiModel(model: string): boolean {
  const geminiPatterns = ['gemini']
  const lowerModel = model.toLowerCase()
  return geminiPatterns.some((pattern) => lowerModel.includes(pattern))
}

function isMoonshotModel(model: string): boolean {
  const moonshotPatterns = ['moonshot', 'kimi']
  const lowerModel = model.toLowerCase()
  return moonshotPatterns.some((pattern) => lowerModel.includes(pattern))
}

function isZaiModel(model: string): boolean {
  const zaiPatterns = ['zai', 'glm']
  const lowerModel = model.toLowerCase()
  return zaiPatterns.some((pattern) => lowerModel.includes(pattern))
}

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url)
    const agent = searchParams.get('agent')
    const model = searchParams.get('model')

    if (!agent) {
      return NextResponse.json({ error: 'Agent parameter is required' }, { status: 400 })
    }

    let provider = AGENT_PROVIDER_MAP[agent]
    if (provider === undefined) {
      return NextResponse.json({ error: 'Invalid agent' }, { status: 400 })
    }

    // Special handling for Copilot - check if user has GitHub token
    if (agent === 'copilot') {
      const { getUserGitHubToken } = await import('@/lib/github/user-token')
      const githubToken = await getUserGitHubToken()
      const hasKey = !!githubToken

      return NextResponse.json({
        success: true,
        hasKey,
        provider: 'github',
        agentName: 'Copilot',
      })
    }

    // Override provider based on model for multi-provider agents
    if (model && (agent === 'cursor' || agent === 'opencode')) {
      if (isAnthropicModel(model)) {
        provider = 'anthropic'
      } else if (isGeminiModel(model)) {
        provider = 'gemini'
      } else if (isMoonshotModel(model)) {
        provider = 'moonshot'
      } else if (isZaiModel(model)) {
        provider = 'zai'
      } else if (isOpenAIModel(model)) {
        provider = agent === 'opencode' ? 'openai' : 'aigateway'
      }
    }

    // Check if API key is available (either user's or system)
    const apiKey = await getUserApiKey(provider!)
    const hasKey = !!apiKey

    return NextResponse.json({
      success: true,
      hasKey,
      provider,
      agentName: agent.charAt(0).toUpperCase() + agent.slice(1),
    })
  } catch (error) {
    console.error('Error checking API key:', error)
    return NextResponse.json({ error: 'Failed to check API key' }, { status: 500 })
  }
}
