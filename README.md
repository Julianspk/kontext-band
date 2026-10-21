# kontext-band

Eine Mod für Claude Code, die über dem Prompt eine Leiste zeigt: wie lange der Prompt-Cache noch hält, wie gut er getroffen hat und wie voll der Kontext ist. Steht dort `cache 3m` in Rot, läuft der Cache in drei Minuten ab. Steht dort `Kontext 91%` in Rot, ist es Zeit für `Compact`.

## Voraussetzungen

- Claude Code mit Unterstützung für Hooks-Module (Mods). Diese API ist im Early Access und kann sich ändern. Entwickelt und getestet wurde die Mod mit Claude Code 2.1.304.
- Eine Oberfläche, die das Band über dem Prompt zeichnet: das Terminal oder die Desktop-App.

## Installation

Im Prompt einer Terminal-Session:

```
/plugin install kontext-band --marketplace Julianspk/kontext-band
```

Aus einer Shell:

```
claude plugin install kontext-band --marketplace Julianspk/kontext-band
```

In der Desktop-App, wo `/plugin` nicht läuft: auf + neben dem Prompt-Feld klicken, dann Plugins, Add marketplace mit `Julianspk/kontext-band`, dann Add plugin.

Ablauf bei der Installation:

1. Claude Code fragt `Add marketplace?` und nennt `github:Julianspk/kontext-band`. Mit `y` bestätigen.
2. Einen Gültigkeitsbereich wählen, zum Beispiel den für deinen Benutzer.
3. Danach steht `Installed kontext-band. Plugin is now active.` Die Mod ist sofort aktiv.

## Benutzung

Du musst nichts tun. Die Leiste steht über dem Prompt und aktualisiert sich selbst.

```
● cache 3m ▮▮▮▮▮▮▮▮▮▮▮▮ 93% hit   |   182k / 200k Tokens   |   Kontext 91% [Compact]   x
```

Von links nach rechts, getrennt durch `|`:

| Gruppe | Anzeige | Bedeutung |
| --- | --- | --- |
| Cache | `cache 3m` | Minuten, bis der Prompt-Cache abläuft. Grün über 15 Minuten, gelb bis 5 Minuten, darunter rot. |
| Cache | Balken | 12 Segmente, grün ist der Anteil der Restzeit. |
| Cache | `93% hit` | Anteil der Eingabe-Tokens, die der Cache im letzten Turn geliefert hat. |
| Tokens | `182k / 200k Tokens` | Belegte Tokens und Größe des Kontextfensters. |
| Kontext | `Kontext 91%` | Füllstand des Kontextfensters. Gelb ab 70 %, rot ab 85 %. |
| Kontext | `Compact` | Kompaktiert die Unterhaltung, wie `/compact`. |
| rechts | `x` | Blendet die Leiste aus. |

Vor dem ersten abgeschlossenen Turn stehen Cache-Zeit und Trefferquote auf `–`. Direkt nach einem Compact fehlen auch die Tokens, bis die nächste Antwort des Modells einen Wert liefert.

### Compact

Der Button löst die Kompaktierung aus und meldet das Ergebnis als Hinweis: `Kompaktiere Kontext ...`, danach `Kontext kompaktiert`, `Compact übersprungen: <Grund>` oder `Compact fehlgeschlagen: <Fehler>`. Läuft gerade ein Turn, ist der Button ausgeblendet.

### Ausblenden und wieder einblenden

- Ausblenden: auf `x` klicken.
- Wieder einblenden: `/kontext-band` eingeben. Die Antwort ist `Kontext-Leiste eingeblendet.`
- Der Zustand gilt für die laufende Session. In einer neuen Session ist die Leiste wieder da.
- Ganz abschalten: `claude plugin disable kontext-band`.

## Wie die Werte entstehen

1. **Cache-Restzeit:** Nach jedem abgeschlossenen Turn des Hauptgesprächs merkt sich die Mod den Zeitpunkt. Die Restzeit ist die Cache-Laufzeit minus die seitdem vergangene Zeit. Sie wird alle 15 Sekunden neu gezeichnet. Während ein Turn läuft, steht sie voll, weil jede Anfrage den Cache auffrischt. Turns von Subagenten zählen nicht.
2. **Trefferquote:** `cache_read_input_tokens` geteilt durch alle Eingabe-Tokens des letzten Turns (ungecacht, gecacht gelesen und neu geschrieben).
3. **Tokens und Kontext:** Die Zahlen kommen von der letzten Antwort des Modells im aktuellen Kontextfenster, so wie sie auch die Statuszeile von Claude Code liest.

## Grenzen

- Die Cache-Laufzeit ist fest auf 60 Minuten eingestellt. Die Mod liest die tatsächliche Laufzeit nicht aus. Läuft dein Cache nur 5 Minuten, ändere `TTL_MS` am Anfang von `hooks/register.tsx` auf `5 * 60_000`. Bis dahin zeigt die Leiste eine zu lange Restzeit.
- Die Restzeit ist eine Schätzung ab dem Ende des letzten Turns. Ein Cache, der aus anderem Grund verfällt, etwa nach einem Modellwechsel, wird nicht erkannt.
- Die Trefferquote bezieht sich auf den letzten Turn, nicht auf die ganze Session.
- Das Wolken-Symbol vor `Kontext` ist ein Emoji und sieht je nach Schrift anders aus.

## Entwicklung

Im Ordner der Mod, mit Claude Code 2.1.304:

```
claude plugin validate .
claude plugin test .
```

Die Logik steht in `hooks/register.tsx`, der Typvertrag für den gespeicherten Zustand in `types/index.d.ts`, der Test in `tests/band.test.tsx`.
