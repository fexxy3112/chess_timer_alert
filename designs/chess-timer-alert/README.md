# Chess Timer Alert — propozycje designu

Projekt utworzony przez lokalny **Figcraft MCP**. Plik `Chess Timer Alert - Design explorations.figcraft` zawiera edytowalne warstwy, dwie strony i sześć makiet. Kod rozszerzenia nie został zmieniony w ramach prac nad designem.

## Trzy kierunki

- **Quiet Mint** — jasny, spokojny panel z zielonym akcentem. Klasyczna lista progów; ustawienia użytkownika w osobnym widoku. Najbardziej uniwersalna propozycja.
- **Midnight Signal** — ciemne powierzchnie, limonkowy akcent i wyraźny status. Czytelny obok ciemnej szachownicy; osobny widok pomocy przy błędzie dźwięku.
- **Classic Club** — kremowe tło, ciemna zieleń i szeryfowy tytuł. Kompaktowe kafelki progów oraz ustawienia zegara dostępne na głównym ekranie.

Główne makiety mają 390 × 600 px. UI zachowuje angielskie etykiety obecnego rozszerzenia; komentarze porównawcze są po polsku. Eksporty pojedynczych wariantów są w skali 2×.

## Strony i prototyp

1. **01 - Design directions**: porównanie trzech kierunków i trzy punkty startowe prototypu.
2. **02 - States and settings**: konfiguracja zegara, problem z dźwiękiem oraz pierwsze uruchomienie / pusty stan.

Przykładowe przejścia w podglądzie prototypu:

- Quiet Mint: **Clock & player** otwiera ustawienia; **Back to alerts** i **Save changes** wracają do panelu.
- Midnight Signal: **Test sound** pokazuje przykładową ścieżkę zablokowanego dźwięku; **Back to alerts** wraca do panelu. To demonstracja scenariusza błędu, nie reguła działania przycisku.
- Classic Club: **Clear** otwiera pusty stan; **Set up 30 / 10 / 5 s** prowadzi do panelu z proponowanymi progami.

Prototyp przedstawia nawigację i wygląd. Nie zapisuje ustawień, nie odtwarza audio i nie symuluje wszystkich kontrolek. Przy wdrożeniu zmiany ustawień nadal wymagają **Save**, a test dźwięku w popupie nie potwierdza uprawnień do audio w karcie gry.

## Podglądy

- `01-design-directions.png` — pełne porównanie.
- `02-states-and-settings.png` — dodatkowe stany.
- `quiet-mint.png`, `midnight-signal.png`, `classic-club.png` — pojedyncze warianty.
