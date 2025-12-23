# IZSU Data Visualization

A minimalist web application for visualizing Izmir Water and Sewerage Administration (IZSU) open data.

## Features

- **Dam Status**: Current fill rates, water levels and capacity information
- **Water Production**: Daily and monthly production data, distribution by source
- **Water Outages**: Fault-based outages, affected areas
- **Water Quality Analysis**: Weekly, district-based and dam water quality reports
- **Dams and Wells**: Location information and interactive map

## Technical Features

- **Zero Backend**: Fully client-side static site
- **Smart Caching**: Caches API data with localStorage (default 24 hours)
- **Configurable TTL**: Cache duration can be changed by user
- **Theme Support**: Dark and light theme options
- **Accent Colors**: Cyan, green, orange, pink

## Installation

```bash
# Clone the repo
git clone https://github.com/aft/izmirsu.git

# Enter directory
cd izmirsu

# Run with any static server
# Example: Python
python -m http.server 8000

# Example: Node.js (with npx)
npx serve
```

## GitHub Pages Deployment

1. Enable Pages from repository settings
2. Select `main` branch and `/ (root)` as source
3. Save

Site will be published at `https://aft.github.io/izmirsu`.

## File Structure

```
izmirsu/
  index.html          # Main HTML file
  src/
    styles.css        # Styles
    cache.js          # localStorage cache module
    api.js            # IZSU API service
    charts.js         # Chart.js chart module
    app.js            # Main application
  README.md
```

## APIs Used

All data is fetched from [Izmir Metropolitan Municipality Open Data Portal](https://openapi.izmir.bel.tr).

| Endpoint | Description |
|----------|-------------|
| `/api/izsu/barajdurum` | Dam fill rates |
| `/api/izsu/barajvekuyular` | Dam and well locations |
| `/api/izsu/gunluksuuretimi` | Daily water production |
| `/api/izsu/suuretiminindagilimi` | Monthly production distribution |
| `/api/izsu/arizakaynaklisukesintileri` | Water outages |
| `/api/izsu/haftaliksuanalizleri` | Weekly water analysis |
| `/api/izsu/cevreilcesuanalizleri` | District water analysis |
| `/api/izsu/barajsukaliteraporlari` | Dam water quality |

## Dependencies

- [Chart.js](https://www.chartjs.org/) - Chart library
- [Leaflet](https://leafletjs.com/) - Map library
- [JetBrains Mono](https://www.jetbrains.com/lp/mono/) - Font

## License

MIT
