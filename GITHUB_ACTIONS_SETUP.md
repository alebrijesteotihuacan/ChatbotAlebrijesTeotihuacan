# Setup de GitHub Actions para deploy automatico

## Que se logro

- Repositorio en GitHub: https://github.com/alebrijesteotihuacan/ChatbotAlebrijesTeotihuacan
- Commits pusheados con la fase 2 y 3 completas
- Workflow de GitHub Actions en `.github/workflows/deploy.yml`

## Por que GitHub Actions y no Vercel Git Integration

La integracion nativa de Vercel con GitHub requiere autorizar la cuenta de Vercel
a traves de OAuth en el dashboard. Esto no se pudo completar via API/CLI porque:

1. El comando `vercel git connect` requiere que la cuenta de Vercel tenga
   el GitHub account ya conectado
2. La API de Vercel para deploy hooks no es accesible con el token actual

GitHub Actions resuelve esto ejecutando el mismo `vercel deploy` que ya usabamos
manualmente, pero de forma automatica en cada push.

## Secrets requeridos en GitHub

Ve a: https://github.com/alebrijesteotihuacan/ChatbotAlebrijesTeotihuacan/settings/secrets/actions

Agrega estos 3 secrets (los valores estan en tu `.env` local):

| Secret | Descripcion |
|--------|-------------|
| `VERCEL_TOKEN` | Token de Vercel CLI (`vcp_...`) |
| `VERCEL_ORG_ID` | ID de organizacion (`team_...`) |
| `VERCEL_PROJECT_ID` | ID del proyecto (`prj_...`) |

## Comportamiento del workflow

- **Push a `main`** -> Deploy a PRODUCCION
- **Pull Request a `main`** -> Deploy PREVIEW con comentario automatico
- **Push a otra rama** -> No se deploya

## Alternativa: Connect Git via Vercel Dashboard

Si en algun momento se quiere usar la integracion nativa de Vercel:

1. Ve a https://vercel.com/hazielmacias-projects/alebrijes-chatbot/settings/git
2. Click "Connect Git Repository"
3. Selecciona GitHub
4. Autoriza la organizacion o tu cuenta personal
5. Selecciona el repo `ChatbotAlebrijesTeotihuacan`
6. Branch de produccion: `main`

Esto dara previews automaticas en PRs, rollback, y mejor integracion.
