# IZSU Veri Goruntuleme

Izmir Su ve Kanalizasyon Idaresi (IZSU) acik verilerini goruntuleyen minimalist web uygulamasi.

## Ozellikler

- **Baraj Durumlari**: Guncel doluluk oranlari, su seviyeleri ve kapasite bilgileri
- **Su Uretimi**: Gunluk ve aylik uretim verileri, kaynaklara gore dagilim
- **Su Kesintileri**: Ariza kaynakli kesintiler, etkilenen bolgeler
- **Su Kalitesi Analizleri**: Haftalik, ilce bazli ve baraj su kalitesi raporlari
- **Baraj ve Kuyular**: Konum bilgileri ve interaktif harita

## Teknik Ozellikler

- **Sifir Backend**: Tamamen istemci tarafinda calisan statik site
- **Akilli Onbellekleme**: localStorage ile API verilerini onbellekler (varsayilan 24 saat)
- **Ayarlanabilir TTL**: Onbellek suresi kullanici tarafindan degistirilebilir
- **Tema Destegi**: Koyu ve acik tema secenekleri
- **Vurgu Renkleri**: Cyan, yesil, turuncu, pembe

## Kurulum

```bash
# Repoyu klonla
git clone https://github.com/username/izmirsu.git

# Dizine gir
cd izmirsu

# Herhangi bir statik sunucu ile calistir
# Ornek: Python
python -m http.server 8000

# Ornek: Node.js (npx ile)
npx serve
```

## GitHub Pages Yayini

1. Repository ayarlarindan Pages'i aktif et
2. Source olarak `main` branch ve `/ (root)` sec
3. Kaydet

Site `https://username.github.io/izmirsu` adresinde yayinlanacak.

## Dosya Yapisi

```
izmirsu/
  index.html          # Ana HTML dosyasi
  src/
    styles.css        # Stiller
    cache.js          # localStorage onbellek modulu
    api.js            # IZSU API servisi
    charts.js         # Chart.js grafik modulu
    app.js            # Ana uygulama
  README.md
```

## Kullanilan API'ler

Tum veriler [Izmir Buyuksehir Belediyesi Acik Veri Portali](https://openapi.izmir.bel.tr) uzerinden alinmaktadir.

| Endpoint | Aciklama |
|----------|----------|
| `/api/izsu/barajdurum` | Baraj doluluk oranlari |
| `/api/izsu/barajvekuyular` | Baraj ve kuyu konumlari |
| `/api/izsu/gunluksuuretimi` | Gunluk su uretimi |
| `/api/izsu/suuretiminindagilimi` | Aylik uretim dagilimi |
| `/api/izsu/arizakaynaklisukesintileri` | Su kesintileri |
| `/api/izsu/haftaliksuanalizleri` | Haftalik su analizleri |
| `/api/izsu/cevreilcesuanalizleri` | Ilce su analizleri |
| `/api/izsu/barajsukaliteraporlari` | Baraj su kalitesi |

## Bagimliliklar

- [Chart.js](https://www.chartjs.org/) - Grafik kutuphanesi
- [Leaflet](https://leafletjs.com/) - Harita kutuphanesi
- [JetBrains Mono](https://www.jetbrains.com/lp/mono/) - Yazi tipi

## Lisans

MIT
