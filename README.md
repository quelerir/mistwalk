# Mistwalk

Мобильное приложение: реальная карта закрыта «туманом войны», который рассеивается, пока вы ходите. Найденные места, страны и города, рейтинг игроков. React Native (Expo SDK 55), карта MapLibre, данные в Supabase.

Это не Expo Go: в приложении есть нативные модули, поэтому его нужно собрать. Папки `ios/` и `android/` уже лежат в репозитории.

## Что понадобится

- Node.js 20 или новее и npm
- Для iPhone: Mac, Xcode (версия должна поддерживать iOS вашего телефона), CocoaPods
- Для Android: Android Studio (SDK и платформа-тулс), JDK 17
- Файл `.env` с ключами Supabase (его присылает владелец проекта, в репозитории его нет)

## Первый запуск

```bash
git clone https://github.com/quelerir/fog-of-war-map.git
cd fog-of-war-map
npm install
cp .env.example .env
```

Откройте `.env` и впишите два значения, которые вам прислали:

```
EXPO_PUBLIC_SUPABASE_URL=...
EXPO_PUBLIC_SUPABASE_ANON_KEY=...
```

Без `.env` приложение откроется, но не сможет войти и сохранять прогресс.

## iPhone

1. На телефоне: Настройки → Конфиденциальность и безопасность → **Режим разработчика** → включить (телефон перезагрузится).
2. Подключите телефон кабелем к Mac и нажмите «Доверять».
3. **Сначала установите Pods** (без этого Xcode выдаёт ошибку `Unable to open base configuration reference file ... Pods-FogofWarMap.debug.xcconfig`):

```bash
cd ios
LANG=en_US.UTF-8 LC_ALL=en_US.UTF-8 pod install
cd ..
```

4. Откройте в Xcode именно **`ios/FogofWarMap.xcworkspace`** (не `.xcodeproj`). Выберите таргет FogofWarMap → **Signing & Capabilities**:
   - поставьте **Team** (ваш Apple ID, бесплатного хватает);
   - смените **Bundle Identifier** на свой уникальный, например `com.ваше-имя.fogofwar`. Идентификатор автора привязан к его аккаунту, чужой подписать нельзя.
5. Соберите и поставьте на телефон, чтобы приложение работало без компьютера. Xcode закройте или оставьте, команде это не мешает:

```bash
LANG=en_US.UTF-8 LC_ALL=en_US.UTF-8 npx expo run:ios --device --configuration Release
```

Выберите свой телефон в списке. Если сборка ругается на подпись, вернитесь к пункту 4. Если в Xcode вы сменили Bundle Identifier, команда возьмёт его из проекта.

Для разработки (с живой перезагрузкой) уберите `--configuration Release`: тогда приложению нужен запущенный на компьютере `npx expo start --dev-client` и общая с телефоном сеть Wi-Fi.

Первый запуск: на телефоне откройте Настройки → Основные → VPN и управление устройством → ваш Apple ID → **Доверять**. С бесплатным аккаунтом приложение перестаёт открываться через 7 дней, пересоберите его.

## Android

1. На телефоне включите **Отладку по USB** (Настройки → О телефоне → семь раз нажать «Номер сборки» → Для разработчиков → Отладка по USB).
2. Подключите телефон кабелем и проверьте, что он виден: `adb devices`.
3. Соберите и поставьте:

```bash
npx expo run:android --device --variant release
```

Для сборки в Android Studio откройте папку `android/`.

## Проверка

```bash
npx tsc --noEmit
npm test
```

## Как это устроено

- `src/screens`, `src/components`: экраны и интерфейс
- `src/lib`: география, туман, места, маршруты, работа с Supabase
- `supabase/migrations`: схема базы данных, `supabase/functions/pois`: общий кэш мест

## Если что-то не собирается

- **`Unable to open base configuration reference file ... Pods-...xcconfig`:** не выполнен `pod install` в папке `ios/`, или открыт `.xcodeproj` вместо `.xcworkspace`.
- **Ошибка кодировки в CocoaPods:** запускайте команды с `LANG=en_US.UTF-8 LC_ALL=en_US.UTF-8`.
- **Телефон не виден в Xcode:** проверьте кабель (нужен кабель с данными, не только зарядка), порт и что телефон разблокирован и доверяет компьютеру.
- **`iOS не поддерживается этой версией Xcode`:** нужна более новая Xcode, или ставьте приложение на телефон с подходящей iOS.
