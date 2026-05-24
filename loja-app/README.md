# Empório GO — Loja (React Native + Expo)

App nativo iOS/Android da loja Empório GO, escrito em React Native com Expo SDK 56.

## Stack

- **Expo SDK 56** + React Native 0.85 (new architecture habilitada)
- **TypeScript** estrito
- **React Navigation 7** — bottom tabs custom
- **Zustand** — state management (carrinho persiste em AsyncStorage)
- **Firebase JS SDK** — mesmo projeto `adegas-pf` da web
- **Reanimated 4** + Worklets — animações nativas 60fps
- **Expo Image** — cache e transitions otimizadas
- **Expo Haptics** — feedback tátil em interações

## Como rodar localmente

1. **Instalar deps** (já feito no setup):
   ```bash
   cd loja-app
   npm install
   ```

2. **Iniciar o Metro bundler:**
   ```bash
   npx expo start
   ```

3. **Abrir no celular:**
   - Instale **Expo Go** ([iOS](https://apps.apple.com/app/expo-go/id982107779) ou [Android](https://play.google.com/store/apps/details?id=host.exp.exponent))
   - Escaneie o QR code que aparece no terminal
   - O app vai carregar e fazer hot reload conforme você edita

4. **Web (opcional):**
   ```bash
   npx expo start --web
   ```

## Estrutura

```
loja-app/
├── App.tsx                      # Root: NavigationContainer + tabs
├── index.ts                     # Entry point Expo
├── app.json                     # Config do Expo
├── babel.config.js              # Worklets plugin
├── src/
│   ├── firebase.ts              # Firebase init (mesmo projeto adegas-pf)
│   ├── types.ts                 # Product, Banner, Settings, CartItem, …
│   ├── constants/
│   │   ├── theme.ts             # Cores, spacing, shadows, typography
│   │   └── categories.ts        # Lista CATEGORIES com tagline/cor
│   ├── store/
│   │   ├── data.ts              # Zustand: products, banners, settings
│   │   └── cart.ts              # Zustand + AsyncStorage persist
│   ├── components/
│   │   ├── AddressBar.tsx       # Header branco com pin + endereço + carrinho
│   │   ├── BannerCarousel.tsx   # FlatList horizontal com auto-advance
│   │   ├── CategoryChips.tsx    # Scroll horizontal de chips 75px
│   │   └── ProductCard.tsx      # Card 4 colunas com botão +
│   ├── screens/
│   │   ├── HomeScreen.tsx       # ✅ Etapa 1
│   │   ├── CategoriesScreen.tsx # ⏳ Etapa 2 (stub)
│   │   ├── CartScreen.tsx       # ⏳ Etapa 3 (stub)
│   │   ├── OrdersScreen.tsx     # ⏳ Etapa 4 (stub)
│   │   └── AccountScreen.tsx    # ⏳ Etapa 4 (stub)
│   ├── navigation/
│   │   ├── BottomTabs.tsx       # CustomTabBar branca, 5 tabs com badge
│   │   └── types.ts
│   └── utils/
│       └── format.ts            # brl(), firstProductImage()
```

## Roteiro

- ✅ **Etapa 1** — Setup + Home (banners, categorias, grid 4 colunas de produtos)
- ⏳ **Etapa 2** — Página de Categorias (cards roxos) + Detalhe do Produto
- ⏳ **Etapa 3** — Carrinho + Checkout (envia pelo WhatsApp como na web)
- ⏳ **Etapa 4** — Pedidos + Conta + Endereço editável
- ⏳ **Etapa 5** — Build APK (Android) e EAS Build (iOS App Store)
