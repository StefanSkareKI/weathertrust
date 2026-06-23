# WeatherTrust Stockholm

Oberoende noggrannhetsmätning av väderprognoser för Stockholm.
Jämför SMHI, yr.no, Open-Meteo och OpenWeatherMap mot faktiska SMHI-observationer.

## Hur det fungerar

1. **Varje dag** hämtas prognoser för dag+1 t.o.m. dag+5 från alla källor och sparas i databasen.
2. **När en dag har passerat** hämtas SMHI:s faktiska observationer för den dagen.
3. MAE (Mean Absolute Error) beräknas per källa och prognoshorisont.
4. Dashboarden visar vilken källa som är mest noggrann.

## Kom igång lokalt

```bash
npm install
cp .env.example .env.local
# Lägg till din OWM_API_KEY i .env.local (gratis på openweathermap.org)
npm run dev
```

Öppna http://localhost:3000

## Daglig datainsamling

Klicka **"Hämta prognoser nu"** i dashboarden varje dag, eller schemalägg ett HTTP POST-anrop:

```bash
curl -X POST https://din-app.up.railway.app/api/collect
curl -X POST https://din-app.up.railway.app/api/analyze
```

## Driftsättning på Railway

1. Pusha till GitHub
2. Skapa nytt projekt på [railway.app](https://railway.app) → Deploy from GitHub repo
3. Lägg till miljövariabel `OWM_API_KEY` i Railway-inställningarna
4. Lägg till en **Volume** monterad på `/data` (för SQLite-databasen)
5. Sätt `DATA_DIR=/data` som miljövariabel

## Källor

| Källa | Modell | API |
|-------|--------|-----|
| SMHI | Harmonie-AROME/SNOW (MetCoOp) | snow1g/v1 (gratis) |
| yr.no | MetCoOp + ECMWF ensemble | api.met.no (gratis) |
| Open-Meteo (ECMWF) | ECMWF IFS 0.25° | open-meteo.com (gratis) |
| Open-Meteo (ICON) | DWD ICON seamless | open-meteo.com (gratis) |
| OpenWeatherMap | Egna globala modeller | API-nyckel krävs |

**Observationer:** Open-Meteo ERA5 reanalys (gratis, archive-api)
