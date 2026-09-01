/*
 * Book Reader for Obsidian — plugin source.
 *
 * Read EPUB, FB2 and PDF books inside Obsidian, highlight passages and turn them
 * into notes. Everything below is the plugin's own code; the libraries it uses
 * (pdf.js, epub.js, JSZip, localForage) come from npm and are bundled at build
 * time by esbuild — see esbuild.config.mjs.
 */
import { AbstractInputSuggest, FuzzySuggestModal, ItemView, MarkdownRenderer, Menu, Modal, Notice, Platform, Plugin, PluginSettingTab, Scope, Setting, TFile, TFolder, normalizePath, requestUrl } from "obsidian";
import * as pdfjsLib from "pdfjs-dist";
import ePub from "epubjs";
import { ER_ZH_CN } from "./i18n-zh.js";

// ---- i18n (RU source / EN / Simplified Chinese) ----
const __erEN = {"Пожелания и ошибки — в телеграм-бота":"Feedback and bugs — in the Telegram bot","Всё, что хочется поменять или починить, теперь собирается в одном месте — в телеграм-боте @book_in_obsidian_bot.":"Everything you would like changed or fixed is now collected in one place — the Telegram bot @book_in_obsidian_bot.","Ни аккаунта на GitHub, ни формы не нужно: заметили ошибку, не хватает возможности, неудобно на телефоне — просто отправьте боту обычное сообщение.":"No GitHub account and no form needed: found a bug, missing a feature, something awkward on the phone — just send the bot an ordinary message.","Читаю всё подряд; из этих сообщений и складывается список того, что делать дальше.":"I read every one of them, and that is what the plan for the next versions is made of.","Пожелания и ошибки":"Feedback and bugs","Всё, что хочется поменять или починить, собирается в телеграм-боте @book_in_obsidian_bot. Напишите ему обычным сообщением — ни аккаунта на GitHub, ни формы не нужно.":"Everything you would like changed or fixed is collected in the Telegram bot @book_in_obsidian_bot. Send it an ordinary message — no GitHub account and no form needed.","Написать в бота":"Message the bot","Обратная связь: ":"Feedback: "," — версия {0}. Автор: Elton.":" — version {0}. Author: Elton.","Пожелания и ошибки теперь собираются в телеграм-боте @book_in_obsidian_bot — просто напишите ему сообщение":"Feedback and bugs are now collected in the Telegram bot @book_in_obsidian_bot — just send it a message","Разбор фрагмента стал диалогом: свой вопрос, свой системный промпт, название книги уходит фоном":"Explaining a passage is a conversation now: your own question, your own system prompt, and the book's title is sent as background context","Читалка подстраивается под устройство: у телефона, планшета и компьютера своя раскладка":"The reader adapts to the device: phone, tablet and desktop each get their own layout","Тема читалки и библиотеки меняется мгновенно, появилась подстройка под тему Obsidian":"Reader and library themes switch instantly, and can follow your Obsidian theme","Движок PDF обновлён — открытие книг стало надёжнее":"The PDF engine has been updated — opening books is more reliable","стр. {0}":"p. {0}","разв. {0}":"spr. {0}","Введите хотя бы два символа":"Type at least two characters","Что найти в книге…":"What to find in the book…","Фильтр по названию…":"Filter by title…","В этой книге не нашлось ни оглавления, ни заголовков.":"No contents and no headings were found in this book.","Каким цветом подсветить фрагмент, если вы написали к нему комментарий, не выбрав цвет вручную. Комментарий может храниться только при выделении, поэтому оно создаётся само.":"Which colour to use when you comment on a passage without picking a colour first. A comment can only be stored on a highlight, so one is created for you.","Цвет выделения по умолчанию":"Default highlight colour","Не удалось сохранить комментарий":"Could not save the comment","Найдено: {0}. Слово подсвечено в тексте.":"Found: {0}. The word is highlighted in the text.","Снять подсветку":"Clear highlight","Эта страница слишком тяжёлая, чтобы нарисовать её":"This page is too heavy to draw","Найденное слово подсвечивается прямо в тексте, чтобы не искать его глазами в абзаце":"The matched word is painted right in the text, so you don't have to hunt for it in the paragraph","Найденное слово подсвечивается жёлтым прямо в тексте книги, поэтому искать его глазами в абзаце не нужно. Через несколько секунд подсветка гаснет сама, чтобы не мешать чтению; убрать сразу — «Снять подсветку» в панели поиска.":"The matched word is painted yellow right in the book's text — and stays painted after you close the panel, so you don't have to hunt for it in the paragraph. Turn it off with \"Clear highlight\" in the search panel.","Поиск по всему тексту книги — список совпадений с фрагментом вокруг каждого, клик переходит к месту.":"Search across the whole book's text — a list of matches with context around each, click to jump to that spot.","Поиск":"Search","Экспорт цитат группирует их по главам и подписывает номер страницы":"Quote export now groups by chapter and labels the page number","Оглавление наконец работает — брало данные, но не показывало их; починил, добавил номер страницы, живой номер разворота и фильтр для длинных списков":"Contents finally works — it had the data but never showed it; fixed, plus page numbers, a live spread number and a filter for long lists","Комментарий к выделению — короткая мысль остаётся при цитате, а не улетает в отдельный файл":"Comment on a highlight — a short thought stays with the quote instead of flying into a separate file","Поиск по всей книге — значок лупы вверху читалки, со списком совпадений и переходом к месту":"Search the whole book — magnifier icon at the top, with a match list and jump-to-spot","Если пунктов много (в технических книгах бывает 300–400), сверху появляется поле фильтра — начните печатать название главы.":"When there are many entries (technical books can have 300–400), a filter field appears at the top — start typing a chapter name.","У каждого пункта — номер страницы книги и номер текущего разворота, который пересчитывается на лету: он меняется при изменении ширины окна или открытии боковых панелей, поэтому его нельзя один раз сохранить.":"Each entry shows the book's own page number and the current spread number, recomputed live — it changes with window width or a sidebar opening, so it can't be stored once and reused.","Плагин ищет оглавление в таком порядке: сначала настоящие закладки из PDF, потом заголовки в тексте, потом печатное содержание книги (та страница со списком глав и точками), и в последнюю очередь — жирные абзацы, если больше зацепиться не за что.":"The plugin looks for a contents source in this order: real PDF bookmarks first, then headings in the text, then the book's own printed contents page (the one with the dotted leaders), and as a last resort, bold paragraphs if nothing else is there to go on.","Оглавление: откуда оно берётся":"Contents: where it comes from","Ищет по части слова: запрос «систем» найдёт и «система», и «системы», и «системный».":"Matches partial words: searching \"system\" finds \"system\", \"systems\" and \"systemic\".","Клик по результату — переход прямо к этому месту, на любом устройстве и при любой ширине окна.":"Click a result to jump straight to that spot, on any device and at any window width.","Значок лупы вверху читалки (или команда «Поиск по книге») открывает поиск по всему тексту — со списком совпадений и фрагментом текста вокруг каждого.":"The magnifier icon at the top of the reader (or the \"Search the book\" command) opens full-text search, with a list of matches and surrounding context for each.","Поиск по книге":"Search the book","Сохраняется по кнопке или Ctrl+Enter. Если очистить поле — комментарий удаляется, сама цитата остаётся.":"Saved with the button or Ctrl+Enter. Clearing the field removes the comment; the quote itself stays.","Пример: подчеркнули спорный тезис и приписали «а вот тут он сам себе противоречит» — эта строка видна в панели «Выделения» под цитатой и попадает в заметку книги при экспорте.":"Example: you highlight a shaky claim and jot \"he contradicts himself right here\" — it shows under the quote in the Highlights panel and travels with it on export.","У выделенного текста, кроме «Создать заметку», есть значок комментария — короткая мысль, которая остаётся ПРИ выделении, а не улетает в отдельный файл.":"Highlighted text has a comment icon besides \"Create a note\" — a short thought that stays WITH the highlight instead of flying off into a separate file.","Комментарий к выделению":"Comment on a highlight","В заметке цитаты собраны по главам, у каждой — номер страницы книги, а комментарий (если вы его оставили) идёт прямо под цитатой.":"In the note, quotes are grouped by chapter, each carries the book's page number, and your comment (if you left one) sits right under the quote.","Инструкция выросла до 21 экрана — теперь разбирает каждую настройку с примерами":"The guide has grown — it now walks through every setting with examples","Режим для e-ink читалок: без анимаций и теней, чистый чёрный на белом, крупнее кнопки":"E-ink reader mode: no animations or shadows, pure black on white, bigger buttons","Выделения переносятся выборочно: галочки, «выделить все», «только новые» — уже перенесённое не задваивается":"Highlights are exported selectively: tick boxes, \"select all\", \"new only\" — nothing already copied gets duplicated","Заметку из выделения можно сразу положить в нужную папку и проставить теги":"A note made from a highlight can go straight into the folder you want, with tags","Картинки из книг теперь показываются сразу — раньше их приходилось искать в другой читалке":"Pictures now show up straight away — previously you had to open another reader to find them","Картинки в книгах":"Pictures in books","Заметка из выделения: название, папка, теги":"A note from a highlight: title, folder, tags","Папка и теги запомнятся для следующей заметки. Сам фрагмент попадёт в текст целиком — название на это не влияет.":"The folder and tags are remembered for the next note. The passage itself goes into the note in full — the title does not affect that.","Например: идеи, психология":"For example: ideas, psychology","Теги":"Tags","Название":"Title","Новая заметка из выделения":"New note from a highlight","Для Obsidian на Android-читалке с электронными чернилами. Убирает анимации, плавные переходы, тени и размытие — они оставляют на таком экране следы. Чистый чёрный на белом, жёсткие рамки, крупнее кнопки, листание без скольжения.":"For Obsidian on an Android e-ink reader. Removes animations, fades, shadows and blur — they leave ghosting on such a screen. Pure black on white, hard borders, bigger buttons, page turns that jump instead of sliding.","Режим для e-ink читалок":"E-ink reader mode","Перенести выделения в заметки":"Move highlights into notes","Инструкция по плагину":"Plugin guide","Инструкция: разбор всех настроек по шагам":"Guide: every setting, step by step","Команды и горячие клавиши":"Commands and hotkeys","Как перенести выделения в заметки":"Moving highlights into notes","Вкладка «Данные»: где что лежит":"The Data tab: where things live","Вкладка «Перевод»":"The Translate tab","Заметка книги и шаблон":"The book note and the template","Куда складывать заметки":"Where notes are filed","Вкладка «Заметки»: название заметки":"The Notes tab: note titles","«Погружение» и цель чтения":"Immersive mode and the reading goal","«Выравнивание» и «Положение текста»":"Alignment and text position","Настройка «Листание страниц»":"The \"Turning pages\" setting","Вкладка «Чтение»: статистика":"The Reading tab: statistics","Дальше — разбор настроек":"Next: a tour of the settings","Что перенести в заметку":"What to copy into the note","Заметка «{0}» — {1} уже перенесено, отмечено {2} новых":"Note \"{0}\" — {1} already there, {2} new ones ticked","Заметка «{0}» — все {1} ещё не перенесены":"Note \"{0}\" — none of the {1} are there yet","Заметка книги не привязана — доступны только отдельные заметки":"No book note linked — separate notes only","Выделить все":"Select all","Снять все":"Clear all","Только новые":"New only","уже в заметке":"already in the note","Отмечено: {0} из {1}":"Ticked: {0} of {1}","В заметку книги":"Into the book note","Отдельными заметками":"As separate notes","Эта цитата уже есть в «{0}»":"That quote is already in \"{0}\"","Все выбранные цитаты уже есть в «{0}»":"All the selected quotes are already in \"{0}\"","Добавлено в «{0}»: {1}, пропущено уже имевшихся: {2}":"Added to \"{0}\": {1}; skipped as already present: {2}","Название подбирается автоматически: первое предложение фрагмента или его начало по границе слова. Выключено — в имя файла идёт весь фрагмент, как раньше.":"The title is chosen automatically: the passage's first sentence, or its opening cut on a word boundary. Off — the whole passage goes into the filename, as before.","Короткие названия без вопросов":"Short titles, no questions","Перед созданием заметки из выделения появится окно с коротким названием — его можно исправить или одной кнопкой вставить фрагмент целиком. Без этого имя файла берётся из самого фрагмента и выходит очень длинным.":"Before a note is created from a highlight, a dialog offers a short title you can edit, or insert the whole passage with one click. Without it the filename is taken from the passage itself and comes out very long.","Спрашивать название заметки":"Ask for the note title","Отмена":"Cancel","Сам фрагмент попадёт в текст заметки целиком — название на это не влияет.":"The passage itself goes into the note in full — the title does not affect that.","Взять весь фрагмент как название":"Use the whole passage as the title","Какую книгу открыть?":"Which book do you want to open?","Книга не найдена: {0}":"Book not found: {0}","Открыть книгу: {0}":"Open book: {0}","Открыть книгу…":"Open a book…","Продолжить чтение (последняя книга)":"Continue reading (last book)","Перестроение при сворачивании панелей стало плавным, а не рывком":"Re-layout when sidebars open or close now fades instead of jumping","Строки заполняют страницу до конца — больше нет пустых мест внизу колонки":"Lines fill the page to the bottom — no more blank gaps at the foot of a column","Листание строго вправо, без съезжания в угол, и текст стал чётким":"Page turns go straight sideways instead of drifting into the corner, and text is sharp","Статистика чтения: сколько всего прочитано, серия дней и график за две недели":"Reading stats: all-time total, day streak and a two-week chart","Книгу можно открыть командой — своя команда и горячая клавиша на каждую книгу":"Open a book by command — each book gets its own command and hotkey","Сколько минут в день вы хотите читать. Прогресс за сегодня — в карточке вверху этой вкладки.":"How many minutes a day you want to read. Today's progress is in the card at the top of this tab.","Откройте книгу и включите таймер ▶ — здесь появится история чтения.":"Open a book and start the timer ▶ — your reading history will appear here.","14 дней назад":"14 days ago","лучший день":"best day","в среднем за день":"daily average","дней с книгой":"days with a book","сегодня":"today","{0} дн. подряд":"{0}-day streak","за всё время с книгами":"all-time with books","{0} д":"{0} d","{0} д {1} ч":"{0} d {1} h","{0} ч":"{0} h","меньше минуты":"less than a minute","Положение на странице":"Position on the page","Положение текста на странице":"Text position on the page","Сверху":"Top","Снизу":"Bottom","Куда прижимать текст, если страница заполнена не до конца — например, в конце главы.":"Where to place the text when a page isn't filled — at the end of a chapter, for instance.","Если страница заполнена не до конца (например, в конце главы), текст можно не оставлять прижатым к верху. Меняется и на лету — в панели настроек чтения.":"When a page isn't filled (at the end of a chapter, for instance), the text needn't stay pinned to the top. Can also be changed on the fly from the reading-settings panel.","Чтение":"Reading","Заметки":"Notes","Данные":"Data","О плагине":"About","Очистка":"Cleanup","Шаблон":"Template","Цель чтения":"Reading goal","Что нового":"What's new","Показать":"Show","Список изменений последних версий.":"Changes from recent versions.","<b>Book Reader</b> — версия {0}. Автор: Elton Labs.":"<b>Book Reader</b> — version {0}. By Elton Labs.","Шрифт, размер и межстрочный интервал настраиваются прямо в книге — иконка ползунков вверху читалки.":"Font, size and line spacing are set inside the book — the sliders icon at the top of the reader.","Доп. настройки":"More settings","Память о книгах":"What the reader remembers","Забыть все книги":"Forget all books","Точно забыть?":"Really forget?","Готово — читалка снова спросит про заметку при открытии книги":"Done — the reader will ask about a note again when you open a book","Забыть настройки этой книги":"Forget this book's settings","Настройки книги сброшены — окно появится при следующем открытии":"Book settings cleared — the setup screen will appear next time you open it","Книг: {0}. Привязанные заметки, категории, шаблоны отдельных книг и отметки «про заметку уже спрашивали». Сами заметки НЕ удаляются — читалка просто забывает связи и спросит про заметку заново при открытии каждой книги.":"Books: {0}. Linked notes, categories, per-book templates and the \"already asked about a note\" marks. The notes themselves are NOT deleted — the reader just forgets the links and will ask about a note again when you open each book.","Заметка книги для ссылок":"Book note for links","Шаблон для этой книги":"Template for this book","Book Reader обновлён до {0}":"Book Reader updated to {0}","Понятно":"Got it","Открыть инструкцию":"Open the guide","Расширенные":"Advanced","Категория":"Category","Например: Психология, Бизнес":"e.g. Psychology, Business","Жанр или тема — по ней книги группируются в библиотеке. Несколько — через запятую. Можно оставить пустым.":"Genre or topic — books are grouped by it in the library. Separate several with commas. Can be left empty.","Жанр или тема — по ней книги группируются в библиотеке. Несколько — через запятую. Пусто — без категории.":"Genre or topic — books are grouped by it in the library. Separate several with commas. Empty means no category.","Цитаты и мысли из книги будут ссылаться на эту заметку.":"Quotes and thoughts from this book will link to this note.","Поиск заметки…":"Search notes…","Создать заметку…":"Create a note…","Создать заметку":"Create note","← Назад":"← Back","В хранилище пока нет заметок — создайте новую ниже":"No notes in the vault yet — create one below","Ничего не найдено":"Nothing found","Все":"All","Читаю":"Reading","Не начатые":"Not started","Прочитано":"Finished","Без папки":"No folder","Заметка для книги":"A note for this book","Куда собирать цитаты и мысли из этой книги? Выделенные фрагменты будут ссылаться на эту заметку.":"Where should quotes and thoughts from this book go? Highlights will link back to this note.","Создать заметку для книги":"Create a note for this book","Название заметки":"Note name","Папка":"Folder","Корень хранилища":"Vault root","Создать и начать читать":"Create and start reading","или":"or","Выбрать существующую заметку":"Pick an existing note","Читать без заметки":"Read without a note","В хранилище пока нет заметок — создайте новую":"There are no notes in the vault yet — create one","Больше не спрашивать — создавать заметку для каждой книги автоматически":"Don't ask again — create a note for every book automatically","Это всегда можно поменять потом — кнопка (i) вверху читалки или настройки плагина.":"You can change this later — the (i) button at the top of the reader, or the plugin settings.","+ Создать новую":"+ Create new","Заметка с этой страницы":"Note from this page","{0} — стр. {1}":"{0} — p. {1}","— из [[{0}]], стр. {1}":"— from [[{0}]], p. {1}","> *(страница-скан — текста для цитаты нет, впишите своими словами)*":"> *(scanned page — no text to quote, write it in your own words)*","Заметка создана: {0}":"Note created: {0}","Показывать картинки из книги":"Show pictures from the book","По умолчанию ВЫКЛ: если из страницы извлекается текст — показывается только чистый текст. Включите, чтобы над текстом показывались иллюстрации, схемы и графики: вырезаются сами картинки, а не скриншот всей страницы. На сканах (где текст извлечь нельзя) страница по-прежнему показывается целиком. Откройте книгу заново, чтобы применить.":"Off by default: when a page yields text, only the clean text is shown. Turn this on to also show the book's illustrations, diagrams and charts above the text — the pictures themselves are cropped out, not a screenshot of the whole page. Scanned pages (where no text can be extracted) are still shown in full. Reopen the book to apply.","Перевод":"Translation","Перевод выделенного":"Translating a selection","Оригинал":"Original","Переводим…":"Translating…","Перевести":"Translate","Копировать перевод":"Copy translation","В заметку":"To a note","Пустой ответ переводчика":"The translator returned nothing","Не удалось перевести. Нужен интернет — перевод идёт через Google Translate, и у него есть лимиты на частые запросы.":"Could not translate. An internet connection is required — translation goes through Google Translate, which rate-limits frequent requests.","Кнопка перевода в выделении":"Translate button in the selection popup","Добавляет кнопку перевода в панельку, которая появляется при выделении текста. Перевод открывается рядом с оригиналом, его можно скопировать или сохранить в заметку под цитатой. Откройте книгу заново, чтобы кнопка появилась.":"Adds a translate button to the popup that appears when you select text. The translation is shown next to the original; you can copy it or save it into a note under the quote. Reopen the book for the button to appear.","Это первая версия функции. Перевод идёт через бесплатный Google Translate: нужен интернет, есть лимиты на частые запросы, а выделенный фрагмент уходит на серверы Google. Для больших объёмов пока не рассчитано.":"This is an early version of the feature. Translation uses the free Google Translate: it needs internet, is rate-limited, and the selected fragment is sent to Google's servers. Not intended for large volumes yet.","Переводить на язык":"Translate into","Язык, на который переводить выделенный фрагмент. Исходный язык определяется автоматически.":"The language to translate the selected fragment into. The source language is detected automatically.","Русский":"Russian","Перевод — это отдельный сетевой запрос к Google. Если вам важно, чтобы текст книги никуда не уходил, оставьте функцию выключенной: всё остальное в читалке работает полностью офлайн.":"Translation is a separate network request to Google. If you need the book's text to stay on your device, leave this off: everything else in the reader works fully offline.","\n\n**Перевод:**\n{0}":"\n\n**Translation:**\n{0}","Читалка открывает три формата: EPUB (.epub), FB2 (.fb2) и PDF (.pdf).":"The reader opens three formats: EPUB (.epub), FB2 (.fb2) and PDF (.pdf).","1. Кладёте файл книги (.epub, .fb2 или .pdf) в хранилище и открываете его кликом.":"1. Put the book file (.epub, .fb2 or .pdf) in your vault and open it with a click.","Этот FB2 упакован в ZIP. Распакуйте архив и положите в хранилище сам файл .fb2.":"This FB2 is packed in a ZIP. Unpack the archive and put the .fb2 file itself into your vault.","Выравнивание текста":"Text alignment","Слева":"Left","По ширине":"Justify","По центру":"Center","Справа":"Right","{0} ч {1} мин":"{0} h {1} min","{0} мин":"{0} min","Своя заметка на каждую книгу":"A separate note per book","При первом открытии книги автоматически создаётся отдельная заметка с названием книги (в «Папке заметок-книг», иначе в «Папке для новых заметок») и привязывается к ней. Дальше все выделения из этой книги идут в её заметку. Выключено по умолчанию.":"On a book's first open, a dedicated note titled after the book is created (in the \"Book notes folder\", otherwise the \"New notes folder\") and linked to it. From then on every highlight from this book goes into its note. Off by default.","Заметка книги создана: {0}":"Book note created: {0}","Это первая версия функции — проверьте результат на паре книг. Заметка создаётся один раз при первом открытии книги.":"This is an early version of the feature — check the result on a couple of books first. The note is created once, on a book's first open.","Как выравнивается текст в колонке чтения. Можно менять и на лету — в панели настроек чтения (иконка ползунков) в самой книге. Откройте книгу заново, чтобы применить.":"How text is aligned in the reading column. You can also change it on the fly from the reading-settings panel (sliders icon) inside a book. Reopen the book to apply.","Сегодня прочитано: {0} мин. Всего за всё время: {1}. Кнопка ▶ вверху запускает обратный отсчёт до цели (пауза — ⏸).":"Read today: {0} min. All-time total: {1}. The ▶ button at the top starts the countdown toward the goal (pause — ⏸).","Сегодня прочитано: {0} мин. Всего за всё время: {1} мин.":"Read today: {0} min. All-time total: {1} min.","Жёлтый":"Yellow","Зелёный":"Green","Голубой":"Blue","Розовый":"Pink","Цель чтения на сегодня достигнута 🎉":"Today's reading goal reached 🎉","Таймер выключен — включите его в настройках чтения":"Timer is off — enable it in reading settings","Таймер сброшен":"Timer reset","Листание":"Page turning","Кнопками":"Buttons","По клику":"By click","«По клику»: клик по левой части страницы — назад, по правой — вперёд. Центр свободен для выделения текста.":"\"By click\": clicking the left part of the page goes back, the right part goes forward. The center stays free for selecting text.","Вкл":"On","Выкл":"Off","Тап по картинке — увеличить · фон или ✕ — закрыть":"Tap the image to zoom · background or ✕ to close","Elton Reader: используем pdf.worker.js из CDN (нужен интернет). Причина:":"Elton Reader: using pdf.worker.js from the CDN (internet required). Reason:","Elton Reader: could not register .pdf, use right-click → Открыть в Elton Reader":"Elton Reader: could not register .pdf, use right-click → Open in Elton Reader","Book Reader — Библиотека":"Book Reader — Library","Открыть библиотеку":"Open library","Открыть PDF в Book Reader":"Open PDF in Book Reader","Сохранить позицию чтения":"Save reading position","Экспортировать выделения в заметки":"Export highlights to notes","📖 Открыть в Book Reader":"📖 Open in Book Reader","Показать приветствие (онбординг)":"Show welcome (onboarding)","Заметка книги для ссылок — начните вводить название…":"Book note for links — start typing a name…","Шаблон заметки — начните вводить путь…":"Note template — start typing a path…","## Заметки из выделений":"## Notes from highlights","Заметка":"Note","Пустое выделение":"Empty highlight","Заметка создана":"Note created","Не удалось создать заметку":"Could not create the note","Нет выделений для экспорта":"No highlights to export","Книга":"Book","Не удалось экспортировать выделения":"Could not export highlights","Нет":"No","Да":"Yes","Для книги не привязана заметка — задайте её в настройках":"No note is linked to this book — set it in settings","## Цитаты":"## Quotes","Цитаты добавлены":"Quotes added","Да, открыть":"Yes, open","Не удалось добавить цитаты в заметку книги":"Could not add quotes to the book note","Как пользоваться Book Reader":"How to use Book Reader","Что делает каждая кнопка и зачем":"What each button does and why","Верхняя панель":"Top bar","Сохранить позицию":"Save position","Запоминает, где вы остановились, и ставит точку возврата (помечена 💾 в «Настройки → Вернуться к месту»). Это как «сохранение» в игре — нажмите перед закрытием книги, если хотите быть точно уверены, что место не потеряется.":"Remembers where you left off and drops a restore point (marked 💾 in \"Settings → Jump back\"). It's like a \"save\" in a game — press it before closing the book if you want to be completely sure your spot won't be lost.","Обновить":"Refresh","Перестраивает страницу заново, если вёрстка «поехала» — например, после смены размера окна или открытия/закрытия боковой панели или вкладки (текст может отобразиться криво). Текущую позицию при этом сохраняет.":"Rebuilds the page if the layout breaks — for example, after resizing the window or opening/closing a sidebar panel or tab (the text may look misaligned). Your current position is preserved.","Выделения":"Highlights","Открывает список всех ваших выделений в этой книге. Клик по строке — переход к этому месту. Сверху списка — кнопка экспорта в заметки.":"Opens the list of all your highlights in this book. Click a row to jump to that spot. Above the list is the export-to-notes button.","Содержание":"Contents","Оглавление книги — быстрый переход по главам.":"The book's table of contents — quickly jump between chapters.","Настройки":"Settings","Тема, шрифт, размер текста, число колонок и блок «Вернуться к месту» — список точек, к которым можно откатиться.":"Theme, font, text size, column count and the \"Jump back\" block — a list of points you can roll back to.","Справка":"Help","Это окно.":"This window.","Чтение и навигация":"Reading and navigation","Листать страницы":"Turn pages","Стрелки внизу экрана, клавиши ← → ↑ ↓ и пробел, либо свайп пальцем на телефоне. Каждое перелистывание автоматически сохраняет позицию — отдельно жать «Сохранить» не обязательно.":"The arrows at the bottom of the screen, the ← → ↑ ↓ keys and space, or a finger swipe on mobile. Every page turn saves your position automatically — you don't need to press \"Save\" separately.","Выделения и заметки":"Highlights and notes","Выделить текст":"Highlight text","Выделите фрагмент мышью или пальцем — всплывёт палитра цветов. Клик по уже готовому выделению — сменить цвет или удалить его.":"Select a fragment with the mouse or a finger — a color palette pops up. Click an existing highlight to change its color or remove it.","Создать заметку из выделения":"Create a note from a highlight","Правый клик по выделенному тексту → «Создать новую заметку». Заметка создаётся по вашему шаблону в выбранной папке, с цитатой и ссылкой на книгу.":"Right-click the highlighted text → \"Create new note\". The note is created from your template in the chosen folder, with the quote and a link to the book.","Экспортировать все выделения":"Export all highlights","Кнопка вверху панели «Выделения». Собирает все выделения книги разом. Спросит формат: одна общая заметка со всеми цитатами, отдельный файл на каждое выделение, либо вставить все цитаты текстом прямо в привязанную заметку книги.":"The button at the top of the \"Highlights\" panel. Collects all of the book's highlights at once. It asks for a format: one shared note with all quotes, a separate file per highlight, or inserting all quotes as text straight into the linked book note.","Куда вести ссылку «— из [[…]]» в заметках из выделений. Пусто — имя файла книги.":"Where the \"— from [[…]]\" link in highlight notes points. Empty — the book's file name.","Сначала откройте книгу…":"Open a book first…","Выбрать из списка…":"Choose from the list…","В хранилище нет заметок":"No notes in the vault","Свой шаблон только для этой книги (например, под жанр). Пусто — используется общий шаблон из настроек плагина.":"A template just for this book (for example, per genre). Empty — the shared template from the plugin settings is used.","Templates/Шаблон.md":"Templates/Template.md","Про автосохранение":"About autosave","Позиция сохраняется сама при каждом перелистывании и хранится в общем файле, который синхронизируется между устройствами (Obsidian Sync). Перестроение страницы (смена размера окна, панелей, масштаба) больше НЕ двигает и не пересохраняет прогресс — поэтому он не «уезжает» сам по себе.":"Your position is saved automatically on every page turn and kept in a shared file that syncs across devices (Obsidian Sync). Rebuilding the page (resizing the window, panels, zoom) no longer moves or re-saves progress — so it won't \"drift\" on its own.","Добро пожаловать в Book Reader!":"Welcome to Book Reader!","Это уютная читалка книг прямо внутри Obsidian. Читаете, выделяете важное и превращаете выделения в заметки — не выходя из хранилища.":"It's a cozy book reader right inside Obsidian. Read, highlight what matters and turn highlights into notes — without leaving your vault.","Пролистайте несколько экранов стрелкой → (или кнопкой «Далее»). Это займёт минуту, зато потом всё будет понятно.":"Flip through a few screens with the → arrow (or the \"Next\" button). It takes a minute, but then everything will be clear.","Какие форматы и как открыть книгу":"Which formats, and how to open a book","Читалка открывает два формата: EPUB (файлы .epub) и PDF (файлы .pdf).":"The reader opens two formats: EPUB (.epub files) and PDF (.pdf files).","Чтобы читать книгу, положите её файл в своё хранилище Obsidian и просто кликните по нему — она откроется в читалке.":"To read a book, put its file into your Obsidian vault and just click it — it opens in the reader.","На левой панели есть значок 📖 «Библиотека» — там все ваши книги с обложками в одном месте.":"In the left sidebar there's a 📖 \"Library\" icon — all your books with covers in one place.","Это самая первая версия":"This is the very first version","Пожалуйста, не загружайте сразу много книг. Начните с двух-трёх и проверьте, что всё работает стабильно именно на вашем устройстве.":"Please don't load a lot of books at once. Start with two or three and check that everything works reliably on your device.","Особенно аккуратно с очень большими PDF (сотни страниц или сканы картинок) — они тяжёлые и могут подтормаживать.":"Be especially careful with very large PDFs (hundreds of pages or scanned images) — they're heavy and may lag.","Плагин будет становиться лучше. А пока — по чуть-чуть и бережно 🙂":"The plugin will keep getting better. For now — little by little and gently 🙂","Выделения: цвета и действия":"Highlights: colors and actions","Выделите текст пальцем или мышью — появится палитра. Выберите цвет, и выделение сохранится.":"Select text with a finger or the mouse — a palette appears. Pick a color and the highlight is saved.","Нажмите на уже готовое выделение — откроется то же меню: сменить цвет, скопировать, поставить закладку «остановился здесь», создать заметку, отправить в заметку книги или удалить.":"Tap an existing highlight — the same menu opens: change color, copy, set a \"stopped here\" bookmark, create a note, send it to the book note, or delete.","Все выделения книги собраны в панели 🖍️ наверху — оттуда можно перейти к любому или экспортировать все сразу.":"All of the book's highlights are gathered in the 🖍️ panel at the top — from there you can jump to any of them or export them all at once.","Что такое «заметка книги»":"What a \"book note\" is","У каждой книги можно завести одну обычную заметку Obsidian — её «главную страницу», например «Мастер и Маргарита.md».":"For each book you can keep one ordinary Obsidian note — its \"home page\", for example \"The Master and Margarita.md\".","Когда вы создаёте заметку из выделения, в ней ставится ссылка на эту заметку книги. А ещё цитаты можно отправлять прямо в неё — так все мысли по книге собираются в одном месте.":"When you create a note from a highlight, it links back to this book note. You can also send quotes straight into it — so all your thoughts on the book gather in one place.","Это не обязательно настраивать прямо сейчас — привязать заметку книги можно в любой момент позже. Откройте книгу, нажмите значок ⓘ (справка) вверху читалки и заполните поле «Заметка книги для ссылок». Пока ничего не привязано, ссылки просто ведут на имя файла книги.":"You don't have to set this up right now — you can link a book note at any time later. Open the book, press the ⓘ (help) icon at the top of the reader and fill in the \"Book note for links\" field. Until something is linked, links simply point to the book's file name.","Где всё хранится":"Where everything is stored","Ваш прогресс чтения и выделения хранятся файлами прямо в хранилище (рядом с книгами или в отдельной папке — это настраивается). Ничего не спрятано «внутри плагина» — всё лежит у вас.":"Your reading progress and highlights are stored as files right in the vault (next to the books or in a separate folder — it's configurable). Nothing is hidden \"inside the plugin\" — it's all yours.","Заметки из выделений и заметки книги — это самые обычные .md заметки в вашей папке. Открывайте, редактируйте и связывайте их, как любые другие.":"Highlight notes and book notes are ordinary .md notes in your folder. Open, edit and link them like any others.","Про синхронизацию":"About syncing","Раз прогресс и выделения — это файлы в хранилище, они синхронизируются вместе с ним (Obsidian Sync, iCloud и т.п.).":"Since progress and highlights are files in the vault, they sync along with it (Obsidian Sync, iCloud, etc.).","Дайте синхронизации закончиться, прежде чем открывать ту же книгу на другом устройстве, и не читайте одну книгу на двух устройствах сразу — иначе позиция может «поспорить сама с собой».":"Let syncing finish before opening the same book on another device, and don't read one book on two devices at once — otherwise the position may \"argue with itself\".","На разных устройствах путь к папке с книгами бывает разным — проверьте папки в настройках плагина.":"The path to the books folder can differ across devices — check the folders in the plugin settings.","Пример: как это всё работает":"Example: how it all works","1. Кладёте файл книги (.epub или .pdf) в хранилище и открываете его кликом.":"1. Put a book file (.epub or .pdf) into the vault and open it with a click.","2. Читаете. Позиция сохраняется сама при каждом перелистывании — ничего нажимать не нужно.":"2. Read. Your position saves itself on every page turn — nothing to press.","3. Понравилась мысль — выделяете её и выбираете цвет. Выделение сохранилось.":"3. Like a thought — highlight it and pick a color. The highlight is saved.","4. (по желанию) Нажимаете ⓘ вверху и привязываете «заметку книги» — свою страницу для этой книги. Это можно сделать и потом.":"4. (optional) Press ⓘ at the top and link a \"book note\" — your page for this book. You can do this later too.","5. Нажимаете на выделение → «в заметку книги» — цитата улетает в эту страницу, и плагин предложит открыть её. Готово: все ваши цитаты в одном месте.":"5. Tap a highlight → \"to book note\" — the quote flies into that page, and the plugin offers to open it. Done: all your quotes in one place.","Готово — приятного чтения!":"All set — enjoy your reading!","Что настроить по желанию (не обязательно сразу): папку для книг и папку для заметок — в настройках плагина. Заметку книги — под значком ⓘ прямо во время чтения.":"What to set up if you like (not required right away): the books folder and the notes folder — in the plugin settings. The book note — under the ⓘ icon while reading.","Что можно вообще не трогать: прогресс и выделения работают сразу и сохраняются сами.":"What you can leave alone entirely: progress and highlights work right away and save themselves.","Полная справка по каждой кнопке — значок ⓘ в читалке. Этот экран приветствия можно снова открыть в настройках плагина.":"Full help for every button — the ⓘ icon in the reader. You can reopen this welcome screen in the plugin settings.","Нажмите «Начать читать» и откройте свою первую книгу 📖":"Press \"Start reading\" and open your first book 📖","‹ Назад":"‹ Back","Начать читать":"Start reading","Далее ›":"Next ›","Пропустить":"Skip","Загружаем книгу…":"Loading the book…","Ошибка при открытии файла":"Error opening the file","Сбросить таймер":"Reset timer","Таймер: сколько осталось до цели — старт/пауза":"Timer: time left to the goal — start/pause","Обновить (перерисовать вид)":"Refresh (redraw the view)","Оглавление":"Table of contents","Настройки чтения":"Reading settings","Создать новую заметку":"Create new note","Текстом в заметку книги":"As text into the book note","Нечего сохранять":"Nothing to save","Книга не открыта":"No book is open","Тема":"Theme","Тёмная":"Dark","Светлая":"Light","Сепия":"Sepia","Размер шрифта":"Font size","Шрифт":"Font","Межстрочный":"Line spacing","Страниц рядом":"Pages side by side","1 страница":"1 page","2 страницы":"2 pages","Вернуться к месту":"Jump back","Действия":"Actions","Точек пока нет":"No points yet","Недоступно":"Unavailable","Нечего обновлять":"Nothing to refresh","Обновлено":"Refreshed","Копировать текст":"Copy text","Скопировано ✓":"Copied ✓","Не удалось скопировать":"Could not copy","Остановился здесь":"Stopped here","Экспортировать в заметку книги":"Export to the book note","Выделение не найдено":"Highlight not found","Пока нет выделений.\nВыделите текст и выберите цвет.":"No highlights yet.\nSelect text and pick a color.","Удалить":"Delete","Закрыть":"Close","Библиотека":"Library","Поиск книги…":"Search a book…","Меньше обложки":"Smaller covers","Больше обложки":"Larger covers","Нет книг":"No books","Все папки vault":"All vault folders","книг":"books","книги":"books","книга":"book","Вид обложки":"Cover fit","Не читалась":"Not started","Ещё":"More","Перейти к странице":"Go to page","Перейти":"Go","Приветствие и инструкция":"Welcome and guide","Показать вводный экран с объяснением форматов, заметки книги, хранения данных и синхронизации.":"Show the intro screen explaining formats, the book note, data storage and syncing.","Открыть приветствие":"Open welcome","Папка с книгами":"Books folder","Пусто = весь vault":"Empty = the whole vault","Папка данных чтения":"Reading-data folder","Где хранятся прогресс чтения, выделения и резервные копии (reading-progress.json, reading-highlights.json). Пусто — рядом с книгами (в «Папке с книгами»). Файлы синхронизируются вместе с хранилищем.":"Where reading progress, highlights and rescue backups are kept (reading-progress.json, reading-highlights.json). Empty — next to the books (in the \"Books folder\"). The files sync along with the vault.","Рядом с книгами":"Next to the books","Заметки из выделений":"Notes from highlights","Шаблон заметки":"Note template","Путь к вашему шаблону (Templater), который применяется к новой заметке из выделения. Пусто — заметка создаётся без шаблона, только с цитатой. Пример: 0. Files/4. Templates/Шаблон стандартный.md":"Path to your (Templater) template applied to each new highlight note. Empty — the note is created without a template, with just the quote. Example: 0. Files/4. Templates/Default template.md","Папка для новых заметок":"Folder for new notes","Куда сохранять заметки, создаваемые из выделений. Пусто — корень хранилища.":"Where to save notes created from highlights. Empty — the vault root.","Папка заметок-книг (для ссылок)":"Book-notes folder (for links)","Из этой папки берётся список при выборе заметки книги, куда ведёт ссылка «— из [[…]]». Пусто — можно выбрать любую заметку хранилища.":"The list for choosing a book note (where the \"— from [[…]]\" link points) is taken from this folder. Empty — you can pick any note in the vault.","3. Resources/База книг":"3. Resources/Book base","Совет: шаблон можно переопределить для отдельной книги — откройте книгу, нажмите (i) вверху и укажите свой шаблон в поле «Шаблон для этой книги» (удобно, если у разных жанров разное оформление).":"Tip: the template can be overridden per book — open the book, press (i) at the top and set your template in the \"Template for this book\" field (handy if different genres need different formatting).","Сохранять цвет выделений при экспорте":"Keep highlight color on export","Каждая цитата оборачивается в цветной <mark> — цвет выделения виден в готовой заметке (в режиме чтения и live preview, без плагинов). Выключите, если хотите обычные цитаты без HTML.":"Each quote is wrapped in a colored <mark> — the highlight color shows in the finished note (in reading mode and live preview, no plugins needed). Turn it off if you want plain quotes without HTML.","Дублировать страницу картинкой, если есть текст":"Duplicate the page as an image when text exists","По умолчанию ВЫКЛ: если из страницы извлекается текст — показывается только чистый текст, без скриншота. Картинка показывается лишь когда текст извлечь нельзя (сканы, схемы, обложки). Включите, если хотите ВИДЕТЬ оригинальный рисунок страницы над текстом (например, для книг-скетчноутов). Откройте книгу заново, чтобы применить.":"OFF by default: if text can be extracted from the page, only the clean text is shown, without a screenshot. The image is shown only when text can't be extracted (scans, diagrams, covers). Turn it on if you want to SEE the original page image above the text (for example, for sketchnote books). Reopen the book to apply.","Листание страниц":"Page turning","«Кнопками» — стрелки/клавиши/свайп. «По клику» — клик по левой/правой части страницы листает назад/вперёд (центр свободен для выделения текста).":"\"Buttons\" — arrows/keys/swipe. \"By click\" — clicking the left/right part of the page turns back/forward (the center stays free for selecting text).","По клику мышкой":"By mouse click","Таймер цели чтения":"Reading-goal timer","Обратный отсчёт до дневной цели (например, 15 минут) — сколько ещё осталось прочитать. Запускается ВРУЧНУЮ кнопкой ▶ вверху читалки, рядом с «Сохранить» (пауза — ⏸).":"A countdown to your daily goal (for example, 15 minutes) — how much is left to read. Started MANUALLY with the ▶ button at the top of the reader, next to \"Save\" (pause — ⏸).","Цель на день, минут":"Daily goal, minutes","Погружение (Immersive)":"Immersive","Панели сверху и снизу мягко притухают через пару секунд без движения мыши и мгновенно возвращаются при движении — чтобы ничто не отвлекало от текста.":"The top and bottom bars gently dim after a couple of seconds without mouse movement and instantly return when you move — so nothing distracts from the text.","Кэш обложек":"Cover cache","Очистить":"Clear","Кэш очищен":"Cache cleared","Прогресс":"Progress","Прогресс очищен":"Progress cleared","Очистить все":"Clear all","Выделения очищены":"Highlights cleared","Синхронизация между устройствами":"Syncing across devices","Способ синхронизации":"Sync method","Подсказывает плагину, насколько свежо перечитывать файлы прогресса при открытии книги.":"Tells the plugin how eagerly to re-read the progress files when opening a book.","Авто (рекомендуется)":"Auto (recommended)","iCloud / Google Drive / папка":"iCloud / Google Drive / folder","Без синхронизации":"No syncing","Облачные папки (iCloud/Drive) обновляются с задержкой. Если на одном устройстве вы только читаете — конфликтов не будет: плагин перечитывает прогресс при каждом открытии книги и аккуратно сливает выделения.":"Cloud folders (iCloud/Drive) update with a delay. If you only read on one device there will be no conflicts: the plugin re-reads progress every time a book is opened and carefully merges highlights.","✓ Цель достигнута — {0} мин сегодня":"✓ Goal reached — {0} min today","⏱ {0} из {1} мин · {2}%":"⏱ {0} of {1} min · {2}%","{0} мин/день":"{0} min/day","Сегодня прочитано: {0} мин. Кнопка ▶ вверху запускает обратный отсчёт до цели (пауза — ⏸).":"Read today: {0} min. The ▶ button at the top starts the countdown to the goal (pause — ⏸).","\n\n— из [[{0}]]":"\n\n— from [[{0}]]","Выделения — {0}":"Highlights — {0}","---\ncreated: {0}\nsource: \"[[{1}]]\"\ntags: [выделения]\n---\n\n# {2}\n\n{3}\n\n— из [[{4}]]\n":"---\ncreated: {0}\nsource: \"[[{1}]]\"\ntags: [highlights]\n---\n\n# {2}\n\n{3}\n\n— from [[{4}]]\n","Экспортировано выделений: {0}":"Highlights exported: {0}","Создаю заметки: {0}…":"Creating notes: {0}…","Создано заметок: {0}, ошибок: {1}":"Notes created: {0}, errors: {1}","Создано заметок: {0}":"Notes created: {0}","Заметка книги не найдена: {0}":"Book note not found: {0}","Добавлено цитат в «{0}»: {1}":"Quotes added to \"{0}\": {1}","Открыть заметку «{0}» в отдельной вкладке?":"Open the note \"{0}\" in a separate tab?","Отдельная заметка на каждое ({0})":"A separate note for each ({0})","Текстом в заметку книги ({0})":"As text into the book note ({0})","Нет заметок в «{0}»":"No notes in \"{0}\"","Заметка книги: {0}":"Book note: {0}","Шаблон книги: {0}":"Book template: {0}","Экран {0}":"Screen {0}","Готовим книгу… {0}%":"Preparing the book… {0}%","Выделить: {0}":"Highlight: {0}","Сохранено ✓ — {0}%":"Saved ✓ — {0}%","Разворот {0} из {1}":"Spread {0} of {1}","Вернулись к {0}%":"Jumped back to {0}%","Закладка «остановился здесь» — {0}%":"\"Stopped here\" bookmark — {0}%","{0}<span>Экспортировать в заметки ({1})</span>":"{0}<span>Export to notes ({1})</span>","<p style=\"padding:40px;color:var(--er-muted);margin:auto;\">Ошибка: {0}</p>":"<p style=\"padding:40px;color:var(--er-muted);margin:auto;\">Error: {0}</p>","{0}<span>Справка</span>":"{0}<span>Help</span>","Сегодня прочитано: {0} мин.":"Read today: {0} min.","Сохранено: {0}":"Saved: {0}","Книг: {0}":"Books: {0}","Всего: {0}":"Total: {0}","Прогресс чтения и выделения хранятся <b>файлами прямо в хранилище</b>, рядом с книгами:":"Reading progress and highlights are stored <b>as files right in the vault</b>, next to the books:","Поэтому они переезжают между ПК и телефоном <b>любым</b> способом, которым вы синхронизируете само хранилище ":"So they travel between PC and phone by <b>any</b> means you use to sync the vault itself ","(Obsidian Sync, iCloud, Google Drive, Remotely Save и т.п.). Привязка к месту — по номеру абзаца, ":"(Obsidian Sync, iCloud, Google Drive, Remotely Save, etc.). The position is anchored by paragraph number, ","так что ПК и телефон находят одну и ту же точку при любом размере экрана.<br>":"so PC and phone find the same spot at any screen size.<br>","Настройки оформления и кэш обложек — локальные (в <code>data.json</code> плагина) и намеренно не синхронизируются.":"Appearance settings and the cover cache are local (in the plugin's <code>data.json</code>) and are intentionally not synced.","Добавить книгу":"Add a book","Отпустите файлы, чтобы добавить их в библиотеку":"Drop the files to add them to your library","Поддерживаются только файлы PDF, EPUB и FB2":"Only PDF, EPUB and FB2 files are supported","Файлы не выбраны":"No files selected","Добавлено книг: {0}":"Books added: {0}","пропущено: {0}":"skipped: {0}","Не удалось добавить: {0}":"Could not add: {0}","Абзацы в PDF сохраняются как в оригинале — текст больше не склеивается в сплошную стену":"PDF paragraphs are kept as in the original — the text no longer glues into one solid wall","Библиотека: кнопка «Добавить книгу» и перетаскивание файлов (PDF, EPUB, FB2) прямо в окно":"Library: an \"Add a book\" button and drag-and-drop of files (PDF, EPUB, FB2) straight into the window","PDF-движок встроен в плагин — книги открываются офлайн, ничего не подгружается из интернета":"The PDF engine is now bundled in — books open offline, nothing is fetched from the internet","В списке выделений комментарий больше не ломает цитату — он аккуратно встаёт под ней":"In the highlights list a comment no longer breaks the quote — it sits neatly underneath it"};
// New translations go HERE, not into the literal above: that one is a single
// generated line thousands of entries long, and anything added inside it is
// unreviewable and easy to lose. Same table, readable diff.
Object.assign(__erEN, {
  "Закрыть книгу": "Close the book",
  "Перерисовать книгу": "Re-flow the book",
  "Книга перерисована": "The book has been re-flowed",
  "Цитаты сразу в заметку книги": "Quotes straight into the book note",
  "Каждое новое выделение тут же дописывается в заметку этой книги — с главой, номером страницы и ссылкой обратно на место в тексте. Отдельные файлы на каждую цитату при этом не создаются. Заметка должна быть привязана к книге: либо настройкой выше, либо вручную через «⋯» → «Заметка книги». Выключено по умолчанию.":
    "Every new highlight is appended to this book's note as you make it — with the chapter, the page number and a link back to the spot in the text. No separate file per quote. The book needs a note linked to it: either by the setting above, or by hand through \"⋯\" → \"Book note\". Off by default.",
  "При первом открытии книги автоматически создаётся отдельная заметка с названием книги (в «Папке заметок-книг», иначе в «Папке для новых заметок») и привязывается к ней. Выключено по умолчанию. Куда попадают цитаты — отдельная настройка ниже.":
    "On a book's first open, a note named after the book is created (in the book-notes folder, else in the notes folder) and linked to it. Off by default. Where quotes go is a separate setting below.",
  "Куда кладутся ОТДЕЛЬНЫЕ заметки, которые вы создаёте из выделенного фрагмента («Создать заметку»). Одно выделение — один файл. Пусто — корень хранилища. Не путать с «Папкой заметок-книг» ниже: та отвечает за одну общую заметку на книгу.":
    "Where SEPARATE notes go — the ones you make from a passage with \"Create note\". One highlight, one file. Empty means the vault root. Not the same as the book-notes folder below, which holds one shared note per book.",
  "Где лежат заметки-КНИГИ — по одной на книгу, куда собираются все цитаты из неё. Из этой папки берётся список, когда вы привязываете заметку к книге, и она же используется при автосоздании. Пусто — можно выбрать любую заметку хранилища.":
    "Where BOOK notes live — one per book, collecting every quote from it. This folder fills the picker when you link a note to a book, and is where an automatically created one goes. Empty means any note in the vault can be picked.",
  "Куда попадают заметки": "Where notes go",
  "Цитаты и выделения": "Quotes and highlights",
  "Заметка книги": "The book note",
  "Текст на странице": "Text on the page",
  "Режимы": "Modes",
  "Оформление": "Appearance",
  "Как выглядит страница — во вкладке «Оформление». Шрифт, размер и межстрочный интервал настраиваются прямо в книге — иконка ползунков вверху читалки.":
    "How the page looks lives in the Appearance tab. Font, size and line height are set in the book itself — the sliders icon at the top of the reader.",
  "«Страницами» — текст разбит на развороты, листается как книга. «Прокруткой» — одна длинная колонка, которую листаешь пальцем или колесом, как сайт; многие так читают дольше, потому что текст не останавливается на краю страницы. В прокрутке место запоминается по абзацу у ВЕРХНЕГО края экрана, и надёжнее всего отметить его самому: «⋯» → «Сохранить позицию». Откройте книгу заново, чтобы применить.":
    "\"Pages\" splits the text into spreads you turn like a book. \"Scrolling\" is one long column you move with a finger or the wheel, like a web page; many people read for longer that way, because the text does not stop at the edge of a page. While scrolling, your place is remembered by the paragraph at the TOP edge of the screen — and the surest way is to mark it yourself: \"⋯\" → \"Save position\". Reopen the book to apply.",
  "Прогресс автоматически сохраняется при перелистывании, прокрутке и закрытии книги. В режиме прокрутки место привязано к абзацу у верхнего края экрана. «Добавить точку возврата» нужно только тогда, когда вы хотите позже вернуться именно сюда. Откройте книгу заново, чтобы применить.":
    "Progress saves automatically while you turn pages, scroll, and close the book. In scrolling mode the position is anchored to the paragraph at the top edge of the screen. Use \"Add restore point\" only when you want a bookmark you can return to later. Reopen the book to apply.",
  "Создать точку возврата": "Add restore point",
  "Точка возврата создана — {0}%": "Restore point added — {0}%",
  "Текущее место сохраняется автоматически при перелистывании, прокрутке и закрытии книги. Эта кнопка создаёт отдельную точку возврата, к которой можно вернуться позже.":
    "Your current place saves automatically as you turn pages, scroll, and close the book. This button adds a separate restore point you can return to later.",
  "Старые цитаты": "Legacy excerpts",
  "Обратный отсчёт до дневной цели (например, 15 минут) — сколько ещё осталось прочитать. Запускается вручную кнопкой ▶ вверху читалки (пауза — ⏸).":
    "A countdown to your daily goal (for example, 15 minutes). Start it with the ▶ button at the top of the reader; pause with ⏸.",
  "Google ограничил частые переводы. Подождите минуту и попробуйте снова — это ограничение бесплатного Google Translate, а не вашего интернета.":
    "Google is rate-limiting translations. Wait a minute and try again — this is a limit of the free Google Translate, not of your connection.",
  "Переводчик ответил ошибкой {0}. Интернет при этом работает — попробуйте позже.":
    "The translator answered with error {0}. Your connection is fine — try again later.",
  "Не удалось связаться с переводчиком. Похоже, нет интернета.":
    "Could not reach the translator. It looks like there is no internet connection.",
  "Свой вид на каждом устройстве": "A separate look on each device",
  "Размер шрифта, тема, шрифт, интервал, число колонок и выравнивание запоминаются отдельно для компьютера, планшета и телефона. Настройки хранятся в одном файле и синхронизируются, но каждое устройство читает свою часть, поэтому крупный шрифт на телефоне больше не делает его огромным на компьютере. Папки, шаблоны и прогресс чтения остаются общими. Это устройство: {0}.":
    "Font size, theme, typeface, line spacing, column count and alignment are remembered separately for computer, tablet and phone. The settings live in one synced file, but each device reads its own part, so a large size on the phone no longer makes the text enormous on the computer. Folders, templates and reading progress stay shared. This device: {0}.",
  "Экспортировать в заметки ({0})": "Export to notes ({0})",
  "Показать в списке файлов": "Reveal in file explorer",
  "Готово": "Done",
  "Анимация листания": "Page-turn animation",
  "Страница плавно уезжает в сторону при перелистывании — по этому движению видно, что книга сдвинулась и в какую сторону. Не зависит от системной настройки «уменьшить анимацию»: та убирает украшения, а это обратная связь. Выключите, если предпочитаете мгновенное переключение.":
    "The page slides sideways as it turns — that movement is what shows the book moved, and which way. Independent of the system's \"reduce motion\" setting: that one drops decoration, this is feedback. Turn it off if you prefer pages to switch instantly.",
  "Открыть библиотеку в отдельном окне": "Open the library in a separate window",
  "Скопировать как цитату": "Copy as a quote",
  "Цитата скопирована ✓ — вставьте в любую заметку": "Quote copied ✓ — paste it into any note",
  ", стр. {0}": ", p. {0}",
  "Формат скопированной цитаты": "Shape of a copied quote",
  "Что попадает в буфер по кнопке «Скопировать как цитату». Доступны {text}, {book}, {page}, {link}, {comment}. Пусто — вид по умолчанию.": "What the \"Copy as a quote\" button puts on the clipboard. Available: {text}, {book}, {page}, {link}, {comment}. Empty means the default shape.",
  "Не подошли ({0}): {1}. Поддерживаются PDF, EPUB и FB2.":
    "Not accepted ({0}): {1}. PDF, EPUB and FB2 are supported.",
  "Папки пропущены — перетащите сами файлы книг ({0})":
    "Folders were skipped — drop the book files themselves ({0})",
  "Прогресс в свойствах заметки книги": "Progress in the book note's properties",
  "Дописывает в заметку книги свойства reading-progress (процент) и reading-updated (дата). Это те же цифры, что и в файле прогресса, — просто в виде, который понимают Bases: по ним можно строить таблицы и сортировать. Сама заметка больше ничем не трогается.":
    "Adds reading-progress (a percentage) and reading-updated (a date) to the book note's properties. Same numbers as the progress file, in a form Bases understands, so you can build tables and sort by them. Nothing else in the note is touched.",
  "Открыть PDF в читалке": "Open a PDF in the reader",
  "Язык интерфейса плагина. Откройте книгу заново, чтобы применить.":
    "The plugin's interface language. Reopen the book to apply.",
  "Комментарий хранится вместе с выделением и попадает в заметку при переносе. Очистите поле, чтобы удалить его.":
    "The comment is kept with the highlight and travels with it into your notes. Clear the field to remove it.",
  "Открывает список всех ваших выделений в этой книге. Клик по строке — переход к этому месту. У каждого выделения есть значок комментария — короткая мысль, которая остаётся при цитате. Сверху списка — кнопка экспорта в заметки.":
    "Opens every highlight you have made in this book. Click a row to jump to that spot. Each highlight has a comment icon — a short thought that stays with the quote. The export-to-notes button sits above the list.",
  "Оглавление книги: закладки PDF, заголовки, печатное содержание или жирные абзацы — что нашлось первым. У каждого пункта — номер страницы и текущий разворот. Много пунктов — сверху появится фильтр.":
    "The book's contents: PDF bookmarks, headings, the book's own printed contents page or bold paragraphs — whichever turns up first. Each entry shows a page number and the current spread. When there are many entries, a filter appears at the top.",
  "Кнопка вверху панели «Выделения». Откроется список, где можно отметить нужные фрагменты — по одному, «Выделить все» или «Только новые». То, что уже перенесено в заметку книги, помечено и снято с отметки, поэтому повторный экспорт ничего не задваивает. Дальше на выбор: вставить текстом в заметку книги или создать отдельную заметку на каждый фрагмент.":
    "The button at the top of the Highlights panel. It opens a list where you tick what you want — one by one, \"Select all\" or \"New only\". Anything already copied into the book note is marked and left unticked, so exporting again never duplicates it. Then choose: paste them as text into the book note, or make a separate note for each passage.",
  "Следующие экраны проходят по настройкам плагина: что делает каждая, что выбрать и что будет, если ничего не менять.":
    "The next few screens walk through the plugin's settings: what each one does, what to pick, and what happens if you change nothing.",
  "Открыть настройки: шестерёнка Obsidian → «Плагины сообщества» → Book Reader. Вверху пять вкладок: Чтение, Заметки, Перевод, Данные, О плагине.":
    "To open the settings: Obsidian's gear icon → Community plugins → Book Reader. There are five tabs at the top: Reading, Notes, Translation, Data and About.",
  "Ни одну из них не обязательно настраивать сразу — плагин работает и так. Этот разбор нужен, чтобы вы знали, что вообще можно поменять.":
    "None of this has to be set up now — the plugin works as it is. This tour is here so you know what can be changed at all.",
  "Вверху вкладки — карточка со статистикой: сколько прочитано за всё время, серия дней подряд, среднее за день, лучший день и график за две недели.":
    "At the top of the tab there is a stats card: your all-time reading total, your current day streak, the daily average, your best day and a two-week chart.",
  "Она заполняется сама, когда вы читаете с включённым таймером ▶ (кнопка вверху читалки). Настраивать нечего — просто смотрите.":
    "It fills itself in as you read with the timer running (the ▶ button at the top of the reader). Nothing to configure — just look at it.",
  "Пример: «12 ч 30 мин за всё время · 🔥 5 дн. подряд». Если таймер не включать, время не считается.":
    "For example: \"12 h 30 min all-time · 🔥 5-day streak\". If you never start the timer, no time is counted.",
  "«Кнопками» — листаете стрелками внизу, клавишами ← → ↑ ↓ и пробелом, на телефоне свайпом. Центр страницы свободен: выделять текст удобно.":
    "\"Buttons\" — turn pages with the arrows at the bottom, the ← → ↑ ↓ keys and space, or a swipe on a phone. The middle of the page stays free, so selecting text is easy.",
  "«По клику мышкой» — клик по левой половине страницы листает назад, по правой вперёд. Быстрее, но случайный клик может перелистнуть, когда вы хотели выделить фразу.":
    "\"By mouse click\" — clicking the left half of the page goes back, the right half forward. Faster, but a stray click can turn the page when you meant to select a phrase.",
  "Что выбрать: начните с «Кнопками». Переключите на «По клику», если читаете подряд и мало выделяете.":
    "What to pick: start with \"Buttons\". Switch to \"By click\" if you read straight through and highlight little.",
  "Выравнивание — как текст прижат в колонке: слева (рваный правый край, как в браузере), по ширине (ровные оба края, как в бумажной книге), по центру или справа.":
    "Alignment — how the text sits in the column: left (ragged right edge, as in a browser), justified (both edges even, as in a printed book), centred or right.",
  "Положение на странице — что делать, если страница заполнена не до конца, например в конце главы: оставить текст сверху, поставить по центру или прижать вниз.":
    "Position on the page — what to do when a page isn't full, at the end of a chapter for instance: leave the text at the top, centre it, or push it to the bottom.",
  "Что выбрать: «По ширине» + «Сверху» — самый привычный книжный вид. «По центру» имеет смысл, только если вас раздражают полупустые страницы в конце глав.":
    "What to pick: justified + top is the most book-like. Centring is only worth it if half-empty pages at the end of chapters bother you.",
  "Погружение: панели сверху и снизу мягко притухают через пару секунд без движения мыши и возвращаются при первом движении. Ничто не отвлекает от текста.":
    "Immersive: the top and bottom bars gently dim after a couple of seconds without mouse movement and come back the instant you move. Nothing distracts from the text.",
  "Цель на день: ползунок от 5 до 120 минут. Таймер ▶ вверху читалки запускается ВРУЧНУЮ и считает обратный отсчёт до цели, ⏸ ставит на паузу.":
    "Daily goal: a slider from 5 to 120 minutes. The ▶ timer at the top of the reader is started BY HAND and counts down to the goal; ⏸ pauses it.",
  "Важно: таймер не запускается сам. Если забыть нажать ▶, время чтения и статистика не наберутся.":
    "Note: the timer never starts on its own. Forget to press ▶ and neither your reading time nor the statistics will add up.",
  "Выделили фрагмент → «Создать заметку». Откроется окно с тремя полями: название (подставляется короткое, можно поправить или одной кнопкой взять фрагмент целиком), папка и теги.":
    "Highlight a passage → \"Create note\". A dialog opens with three fields: the title (a short one is suggested; edit it, or take the whole passage with one click), the folder and the tags.",
  "Папка выбирается из подсказки, теги — через запятую, с подсказкой из уже используемых в хранилище. И то и другое запоминается для следующей заметки, так что вводить каждый раз не нужно.":
    "The folder is picked from a suggestion list; tags are comma-separated and suggested from the ones already used in your vault. Both are remembered for the next note, so you don't retype them each time.",
  "Пример: выделили абзац про PEP 8 → название «Стиль кода PEP 8», папка «0. Files/5. Inbox», теги «python, стиль». Окно можно отключить в настройках → Заметки.":
    "For example: highlight a paragraph about PEP 8 → title \"PEP 8 code style\", folder \"0. Files/5. Inbox\", tags \"python, style\". The dialog can be turned off in Settings → Notes.",
  "Если Obsidian стоит на Android-читалке с электронными чернилами, включите «Режим для e-ink» в настройках → Чтение.":
    "If Obsidian is running on an Android e-ink reader, turn on \"E-ink reader mode\" in Settings → Reading.",
  "Он убирает всё, что на таком экране оставляет следы: анимации, плавные переходы, тени, размытие и полупрозрачность. Цвета — чистый чёрный на белом, рамки жёсткие, кнопки крупнее под палец.":
    "It removes everything that leaves ghosting on such a screen: animations, fades, shadows, blur and transparency. Colours become pure black on white, borders are hard, and buttons are bigger for a thumb.",
  "Отдельно в списке тем появляется «E-ink» — максимальный контраст без оттенков.":
    "An extra \"E-ink\" theme also appears in the theme list — maximum contrast, no tinting.",
  "«Папка для новых заметок» — куда попадают заметки, созданные из выделений. Пусто — в корень хранилища. Пример: 0. Files/5. Inbox":
    "\"Folder for new notes\" — where notes made from highlights are filed. Empty means the vault root. For example: 0. Files/5. Inbox",
  "«Папка заметок-книг» — откуда берётся список, когда вы выбираете заметку книги. Пусто — можно выбрать любую заметку хранилища. Пример: 3. Resources/База книг":
    "\"Book-notes folder\" — where the list comes from when you pick a book's note. Empty means you can choose any note in the vault. For example: 3. Resources/Book base",
  "Путь пишется от корня хранилища, через косую черту. Папку можно выбрать из подсказки — начните печатать, и появится список.":
    "Paths are written from the vault root, with forward slashes. You can pick a folder from the suggestions — start typing and a list appears.",
  "У каждой книги может быть своя заметка — в неё складываются цитаты и на неё ведут ссылки «— из [[…]]» из всех заметок по этой книге.":
    "Each book can have a note of its own — quotes are collected there, and the \"— from [[…]]\" links in every note about that book point to it.",
  "«Своя заметка на каждую книгу» — создавать её автоматически при первом открытии, не спрашивая. Иначе плагин спросит один раз сам.":
    "\"A separate note per book\" — create it automatically on a book's first open, without asking. Otherwise the plugin asks you once.",
  "«Шаблон заметки» — файл, по которому создаются заметки из выделений. Работает и с Templater, если он у вас стоит. Пусто — заметка будет просто с цитатой и ссылкой.":
    "\"Note template\" — the file new highlight notes are built from. Works with Templater too, if you have it. Empty means the note is just the quote and a link.",
  "Выключено по умолчанию. Если включить, у выделенного текста появится кнопка перевода — удобно для книг на английском.":
    "Off by default. Turn it on and a translate button appears on selected text — handy for books in another language.",
  "Это единственное место, где плагин выходит в интернет: выделенный фрагмент уходит в бесплатный переводчик Google. Больше никуда и ничего не отправляется.":
    "This is the only place the plugin reaches the internet: the selected passage goes to the free Google translator. Nothing else is sent anywhere.",
  "Язык перевода выбирается там же. Перевод можно сохранить в заметку под оригиналом.":
    "The target language is chosen in the same place. A translation can be saved into a note underneath the original.",
  "«Папка с книгами» — где плагин ищет книги для библиотеки. Пусто — ищет по всему хранилищу.":
    "\"Books folder\" — where the plugin looks for books to fill the library. Empty means it searches the whole vault.",
  "«Папка для данных» — где лежат файлы прогресса и выделений. Пусто — рядом с книгами. Эти файлы синхронизируются между устройствами, поэтому чтение продолжается с того же места на телефоне.":
    "\"Data folder\" — where the progress and highlight files live. Empty means next to the books. These files sync between devices, which is how reading carries on from the same spot on your phone.",
  "«Память о книгах» — кнопка «Забыть все книги» сбрасывает привязки заметок и категорий, но сами заметки не удаляет. Нужна, если хотите настроить всё заново.":
    "\"What the reader remembers\" — the \"Forget all books\" button clears the note links and categories without deleting any notes. Use it if you want to set everything up again from scratch.",
  "Кнопка экспорта вверху панели «Выделения» открывает список всех выделений книги с галочками.":
    "The export button at the top of the Highlights panel opens a tick-list of every highlight in the book.",
  "Можно отметить нужные по одному, нажать «Выделить все» или «Только новые». То, что уже перенесено в заметку книги, помечено и снято с отметки — повторный экспорт ничего не задваивает.":
    "Tick them one by one, or use \"Select all\" or \"New only\". Anything already in the book note is marked and left unticked — exporting again never duplicates it.",
  "Дальше на выбор: вставить текстом в заметку книги (всё в одном месте) или создать отдельную заметку на каждый фрагмент (для связей между заметками).":
    "Then choose: paste them as text into the book note (everything in one place), or create a separate note per passage (for linking between notes).",
  "Иллюстрации из PDF показываются прямо в тексте. Страницы-сканы рисуются целиком, а на обычных страницах вырезается сама картинка, а не скриншот всей страницы.":
    "Pictures from a PDF are shown right in the text. Scanned pages are drawn whole, while on ordinary pages the picture itself is cropped out rather than a screenshot of the entire page.",
  "Грузятся они по мере чтения и выгружаются, когда далеко — поэтому книга на 500 страниц с иллюстрациями не съедает память.":
    "They load as you read and are released once they are far behind, so a 500-page illustrated book doesn't eat your memory.",
  "Если картинки мешают и нужен только текст, их можно выключить: настройки → Чтение → «Показывать картинки из книги».":
    "If the pictures get in the way and you only want text, turn them off: Settings → Reading → \"Show pictures from the book\".",
  "В палитре команд (Ctrl+P) есть «Открыть книгу: …» на каждую вашу книгу — можно повесить горячую клавишу и открывать нужную книгу одним нажатием.":
    "The command palette (Ctrl+P) has an \"Open book: …\" entry for every book you have — assign a hotkey and a particular book is one keystroke away.",
  "Ещё есть «Продолжить чтение» — открывает последнюю книгу с того места, где вы остановились, и «Открыть книгу…» — список с поиском.":
    "There is also \"Continue reading\", which opens your last book where you left off, and \"Open a book…\", a searchable list.",
  "Горячая клавиша назначается в настройках Obsidian → «Горячие клавиши», поиск по слову Reader.":
    "Hotkeys are assigned in Obsidian's settings → Hotkeys; search for Reader.",
  "Новый формат: FB2 (в том числе старые файлы в кодировке windows-1251)":
    "New format: FB2, including older files in windows-1251 encoding",
  "Технические книги читаются нормально: код, таблицы и формулы больше не разваливаются":
    "Technical books read properly: code, tables and formulas no longer fall apart",
  "Листинги распознаются даже там, где в книге не указан шрифт кода":
    "Code listings are recognised even where the book declares no monospaced font",
  "Пояснения на полях больше не вклеиваются в строки кода":
    "Margin notes are no longer glued into the middle of code lines",
  "Страницы оглавления с точками отображаются как аккуратный список":
    "Contents pages with dot leaders come out as a tidy list",
  "Короткую страницу можно центрировать по вертикали, а не прижимать к верху":
    "A short page can be centred vertically instead of pinned to the top",
  "Оглавление берётся из самого PDF, а на компьютере оно наконец работает":
    "Contents are taken from the PDF itself, and on desktop it finally works",
  "Из PDF показываются сами иллюстрации, а не скриншот всей страницы":
    "PDFs show the illustrations themselves rather than a screenshot of the page",
  "Перевод выделенного фрагмента — включается в настройках":
    "Translation of a selected passage — switched on in the settings",
  "Библиотека: категории по жанрам и папкам, фильтр «читаю / прочитано»":
    "Library: categories by genre and folder, plus a reading / finished filter",
  "При первом открытии книги можно СОЗДАТЬ для неё заметку, а не только выбрать":
    "On a book's first open you can now CREATE its note, not only pick an existing one",
  "Настройки разложены по вкладкам, редкое убрано в «Доп. настройки»":
    "Settings are split across tabs, with the rarely used ones tucked away",
  "Текст сам перевёрстывается при открытии панелей и не теряет место":
    "The text re-flows by itself when panels open, without losing your place",
  "Исправлено: ввод пути в настройках создавал папку на каждый символ":
    "Fixed: typing a path in the settings created a folder per keystroke",
  "21 экран с объяснением: форматы, выделения, заметка книги, синхронизация, а затем разбор каждой настройки — что делает, что выбрать и что будет, если не трогать.":
    "21 screens of explanation: formats, highlights, the book note, syncing, and then a tour of every setting — what it does, what to pick, and what happens if you leave it alone.",
  "Как читать": "How to read",
  "Страницами": "In pages",
  "Прокруткой": "By scrolling",
  "«Страницами» — текст разбит на развороты, листается как книга. «Прокруткой» — одна длинная колонка, привычная по сайтам; многие так читают дольше, потому что текст не останавливается на краю страницы. Откройте книгу заново, чтобы применить.": "\"In pages\" splits the text into spreads you turn like a book. \"By scrolling\" is one long column, the way a web page reads; many people keep going for longer that way because the text never stops at a page edge. Reopen the book to apply.",
  "↪ к месту в книге": "↪ to this spot in the book",
  "Ссылка на место в книге под цитатой": "Link back to the book under each quote",
  "К каждой выгруженной цитате добавляется ссылка, которая открывает книгу ровно на том абзаце, откуда цитата взята. Работает из любой заметки.": "Every exported quote gets a link that opens the book at the exact paragraph the quote came from. Works from any note.",
  "Вернуться к тексту": "Back to the text",
  "Разобрать фрагмент": "Break this passage down",
  "Разговор о фрагменте": "Talking about the passage",
  "Не удалось подготовить чтение PDF. Переустановите плагин.": "Could not prepare PDF reading. Please reinstall the plugin.",
  "Закрыть": "Close",
  "Раскладываем страницы…": "Laying out the pages…",
  "Как в Obsidian": "Match Obsidian",
  "Сообщение…": "Message…",
  "О чём спросить?": "What would you like to ask?",
  "Спросите что угодно об этом фрагменте — или начните с разбора.":
    "Ask anything about this passage — or start with a breakdown.",
  "Разбери фрагмент": "Break this passage down",
  "Отправить": "Send",
  "Думаю…": "Thinking…",
  "Свой системный промпт": "Your own system prompt",
  "Что именно делать с фрагментом. Пусто — встроенный разбор: перевод, трудные слова, обороты, этимология. Свой текст заменяет его целиком — и для разбора, и для ваших вопросов в окне разбора.":
    "What exactly to do with the passage. Empty — the built-in breakdown: translation, hard words, phrasing, etymology. Your own text replaces it entirely, both for the breakdown and for the questions you type in the breakdown window.",
  "Например: объясни простыми словами и дай два примера из жизни.":
    "For example: explain it in plain words and give two examples from real life.",
  "Разбор фрагмента через ИИ": "AI passage breakdown",
  "Добавляет к выделению кнопку ✨: открывает разговор о выделенном куске. Одним тапом можно попросить разбор — перевод, трудные слова, обороты, этимология, — а можно просто спросить своими словами и продолжить расспрашивать. Сам ничего не спрашивает: фрагмент уходит на выбранный вами сервис только по вашему сообщению. Выключено, пока вы это не настроите.":
    "Adds a ✨ button to the selection popup: it opens a conversation about the passage. One tap asks for a breakdown — translation, hard words, phrasing, etymology — or you can simply ask in your own words and keep asking. It never asks on its own: the passage is sent to the service you choose only when you send a message. Off until you set that up.",
  "Куда обращаться за разбором": "Where breakdowns come from",
  "Сервис, ключ и модель. Локальная модель работает без ключа и не отправляет текст в интернет.":
    "Service, key and model. A local model needs no key and sends nothing to the internet.",
  "Сервис": "Service",
  "Ключ": "Key",
  "Хранится в настройках плагина, внутри вашего хранилища. Если хранилище синхронизируется, ключ едет вместе с ним — держите это в уме.":
    "Kept in the plugin's settings, inside your vault. If the vault syncs, the key travels with it — worth knowing.",
  "Модель": "Model",
  "Пусто — модель по умолчанию для этого сервиса: {0}": "Empty — this service's default model: {0}",
  "Отвечать на языке": "Answer in",
  "На каком языке писать разбор. Язык самой книги определяется сам.":
    "Which language to write the breakdown in. The book's own language is detected.",
  "русском": "English",
  "Локальная модель: текст никуда не уходит, но нужен запущенный Ollama или LM Studio на этом же компьютере.":
    "Local model: nothing leaves the device, but Ollama or LM Studio has to be running on this machine.",
  "Выделенный фрагмент отправляется на {0}. Всё остальное в читалке работает офлайн.":
    "The selected passage is sent to {0}. Everything else in the reader works offline.",
  "Не задан ключ. Откройте настройки плагина → «Разбор ИИ» и вставьте ключ выбранного сервиса.":
    "No key set. Open the plugin settings → AI breakdown and paste the key for your service.",
  "Сервис не принял ключ. Проверьте его в настройках плагина.":
    "The service rejected the key. Check it in the plugin settings.",
  "Сервис ограничил частые запросы. Подождите минуту и попробуйте снова.":
    "The service is rate-limiting. Wait a minute and try again.",
  "Локальная модель не отвечает. Проверьте, запущен ли Ollama или LM Studio.":
    "The local model is not answering. Check that Ollama or LM Studio is running.",
  "Пустой ответ от модели.": "The model returned nothing.",
  "Сервис ответил ошибкой {0}.": "The service answered with error {0}.",
  "Не удалось связаться с сервисом. Похоже, нет интернета.":
    "Could not reach the service. It looks like there is no internet connection.",
  "Копировать": "Copy",
  "Настроить": "Configure",
  "Оформление текста": "Text appearance",
  "Выравнивание, положение на странице, картинки, погружение, режим для e-ink и раздельные настройки вида для компьютера, планшета и телефона.":
    "Alignment, position on the page, pictures, immersive mode, e-ink mode, and a separate look for computer, tablet and phone.",
  "Сначала выделите фрагмент цветом": "Highlight a passage with a colour first",
  "Комментарий сохранён": "Comment saved",
  "Комментарий удалён": "Comment removed",
  "Изменить комментарий": "Edit comment",
  "Ваша мысль об этом фрагменте…": "Your thought about this passage…",
  "Сохранить": "Save",
  " *(стр. {0})*": " *(p. {0})*",
  "Ошибка: {0}": "Error: {0}",
  "Плагин стал легче почти на 4 МБ": "The plugin is nearly 4 MB lighter",
  "Ширина строки": "Line width",
  "Максимальная длина строки в символах. На широком мониторе строка во весь экран уходит за 150 символов, и глаз теряет начало следующей — привычный удобный диапазон 60–90. Лишняя ширина уходит в поля, разбивка книги на страницы от этого не меняется.":
    "Longest line, in characters. On a wide monitor a full-width line runs past 150 characters and the eye loses its place returning to the next one — the comfortable range is 60-90. The spare width becomes margin; how the book is split into pages does not change.",
  "Во всю ширину": "Full width",
  "Класть заметки рядом с книгой": "Keep notes next to the book",
  "Заметка из выделения создаётся в той же папке, где лежит книга, а не в общей папке заметок. Если вы выбрали папку вручную в окне создания, побеждает ваш выбор. Для книги в корне хранилища используется папка из настройки выше.":
    "A note made from a highlight is created in the same folder as the book, instead of the shared notes folder. If you picked a folder by hand in the create dialog, your choice wins. A book in the vault root falls back to the folder set above.",
  "Куда открывать новую заметку": "Where a new note opens",
  "«Рядом с книгой» делит окно пополам, чтобы книга осталась на виду. «В новой вкладке» открывает поверх — книга останется открытой, но уйдёт с экрана.":
    "\"Beside the book\" splits the pane so the book stays in view. \"In a new tab\" opens on top — the book stays open but leaves the screen.",
  "Рядом с книгой": "Beside the book",
  "В новой вкладке": "In a new tab",
  "Не открывать": "Don't open it",
  "Прогресс чтения и выделения хранятся ": "Reading progress and highlights are stored ",
  "файлами прямо в хранилище": "as files right in the vault",
  ", рядом с книгами:": ", next to the books:",
  "Поэтому они переезжают между ПК и телефоном ": "So they travel between PC and phone by ",
  "любым": "any",
  " способом, которым вы синхронизируете само хранилище (Obsidian Sync, iCloud, Google Drive, Remotely Save и т.п.). Привязка к месту — по номеру абзаца, так что ПК и телефон находят одну и ту же точку при любом размере экрана.":
    " means you use to sync the vault itself (Obsidian Sync, iCloud, Google Drive, Remotely Save and so on). The position is anchored by paragraph number, so PC and phone find the same spot at any screen size.",
  "Настройки оформления и кэш обложек — локальные (в ": "Appearance settings and the cover cache are local (in the plugin's ",
  " плагина) и намеренно не синхронизируются.": ") and are intentionally not synced.",
  " — версия {0}. Автор: Elton Labs.": " — version {0}. By Elton Labs.",
  "компьютер": "computer",
  "планшет": "tablet",
  "телефон": "phone",
});
// 3.1.0
Object.assign(__erEN, {
  "Подпись этой ссылки": "Wording of that link",
  "Текст, которым ссылка подписана в заметке. Пусто — стандартная подпись «{0}».":
    "The text the link is labelled with in the note. Empty means the standard «{0}».",
  "В заметку книги": "Into the book's note",
  "Дописать цитату в «{0}» вместо отдельной заметки":
    "Append the quote to «{0}» instead of making a separate note",
  "Отступ сверху на телефоне": "Top inset on mobile",
  "Обычно система сама сообщает высоту «шторки» с часами, и верхняя панель встаёт под ней. На части Android-оболочек (например, Samsung One UI) она этого не делает — панель заезжает под часы. Тогда впишите здесь высоту в пикселях, обычно 24–48. Ноль — доверять системе. Откройте книгу заново, чтобы применить.":
    "Normally the system reports the height of the status bar and the reader's top bar starts below it. Some Android skins (Samsung One UI, for one) do not, and the bar slides under the clock. Then type the height here in pixels, usually 24-48. Zero means trust the system. Reopen the book to apply.",
  "Сохранять «Что нового» заметкой": "Keep «What's new» as a note",
  "После обновления плагина в хранилище появляется заметка со списком изменений — рядом с остальными заметками читалки. Окно «Что нового» показывается один раз, а заметка остаётся.":
    "After the plugin updates, a note listing the changes appears in your vault, next to the reader's other notes. The «What's new» window shows once; the note stays.",
  "Book Reader {0} — что нового": "Book Reader {0} - what's new",
  "Книжная читалка обновилась до версии {0}. Что изменилось:":
    "Book Reader has been updated to {0}. Here is what changed:",
  "Список сохранён заметкой «{0}» — открыть": "Saved as the note «{0}» - open it",
  "Плагин снова открывается там, где раньше писал «Не удалось загрузить»: на Obsidian постарше, на планшетах Huawei и на части Windows-сборок":
    "The plugin loads again where it used to say «Failed to load»: older Obsidian builds, Huawei tablets and some Windows installs",
  "Цитаты можно складывать в одну заметку книги: в окне названия появилась кнопка «В заметку книги», а в меню выделения — «Текстом в заметку книги»":
    "Quotes can pile up in one book note: the title dialog now has an «Into the book's note» button, and the selection menu has «As text into the book's note»",
  "Подпись ссылки «↪ к месту в книге» теперь своя — задаётся в настройках":
    "The wording of the «↪ to this spot in the book» link is yours now - set it in the settings",
  "Клик по выделению в списке ведёт к месту в книге даже там, где страница ещё не отрисована":
    "Tapping a highlight in the list takes you to its place in the book even when that page has not been drawn yet",
  "Панель выделения больше не убегает на пустое место в начале абзаца и на границе страниц":
    "The selection bar no longer jumps to empty space at the start of a paragraph or across a page break",
  "Верхняя панель на Android больше не заезжает под часы; если оболочка телефона молчит о высоте шторки, отступ можно задать руками":
    "On Android the top bar no longer slides under the clock; if the phone's skin keeps the status-bar height to itself, the inset can be set by hand",
  "Что нового теперь сохраняется заметкой в хранилище — не нужно запоминать окно":
    "What's new is saved as a note in your vault, so there is nothing to memorise from a window",
});
Object.assign(__erEN, {
  "Удалить выделение": "Delete highlight",
  "Так будет выглядеть текст книги": "This is how the book text will look",
  "Вид": "Appearance",
  "Страница": "Page",
  "Одна": "One",
  "Две": "Two",
  "Две страницы разворачиваются только на широком экране.": "Two pages are shown only on a wide screen.",
  "Как листать": "Reading mode",
  "Страницы": "Pages",
  "Прокрутка": "Scrolling",
  "Авто": "Auto",
  "Сколько знаков помещается в строку. Короткая строка читается легче.": "How many characters fit on a line. Shorter lines are easier to read.",
  "Удалить книгу?": "Delete the book?",
  "«{0}» будет удалена из хранилища вместе с прогрессом чтения и выделениями. Заметка книги останется на месте.":
    "«{0}» will be deleted from the vault together with its reading progress and highlights. The book note will remain.",
  "Книга удалена: {0}": "Book deleted: {0}",
  "Не удалось удалить книгу": "Could not delete the book",
  "Удалить книгу": "Delete book",
  "Действия с книгой": "Book actions",
  "Шаблон заметки книги": "Reading-note template",
  "Применяется только к общей заметке книги, которая создаётся один раз и собирает выделения и комментарии. Не используется для отдельных заметок из фрагментов. Пусто — заголовок и свойства книги без шаблона.":
    "Used only for the single reading note created for a book, where highlights and comments are collected. It is not used for standalone excerpt notes. Empty means a heading and book properties without a template.",
  "При первом открытии книги автоматически создаётся отдельная заметка с названием книги (в «Папке заметок-книг», иначе в «Папке для новых заметок») и привязывается к ней. Включено по умолчанию.":
    "The first time a book is opened, a reading note named after it is created automatically in the reading-notes folder (or the new-notes folder) and linked to the book. Enabled by default.",
  "Каждое новое выделение и изменение комментария синхронизируется с заметкой этой книги — с главой, номером страницы и ссылкой обратно на место в тексте. Отдельные файлы при этом не создаются. Включено по умолчанию.":
    "Every new highlight and comment change is synchronised to this book's reading note, with its chapter, page number and a link back to the passage. No separate file is created. Enabled by default.",
  "Настройки применяются сразу и сохраняются автоматически.": "Changes appear immediately and are saved automatically.",
  "Текст и шрифт": "Text and font",
  "Параметры страницы": "Page layout",
  "Компактно": "Compact",
  "Обычно": "Standard",
  "Комфортно": "Comfortable",
  "Свободно": "Spacious",
  "Напишите короткую мысль об этом фрагменте…": "Write a short thought about this passage…",
  "Сохранить комментарий": "Save comment",
  "Электронные чернила": "E-ink",
  "Сообщите об ошибке или предложите функцию — мы ответим в GitHub.": "Report a bug or suggest a feature and we will follow up on GitHub.",
  "Открыть GitHub Issues": "Open GitHub Issues",
  " — версия {0}. Автор: 向阳乔木。": " — version {0}. Adapted and maintained by Qiaomu.",
  "Основано на Elton Reader; спасибо Elton Labs и всем участникам оригинального проекта.": "Based on Elton Reader; thanks to Elton Labs and every contributor to the original project.",
  "Новый китайский интерфейс и шрифты Source Han Serif / Source Han Sans": "A new Chinese interface plus Source Han Serif and Source Han Sans.",
  "Ссылки из заметок обратно в книгу теперь показаны одной иконкой, без лишнего текста": "Links from notes back to the book now use one quiet icon without extra words.",
  "Библиотека получила спокойную редакционную компоновку без эмодзи, бликов и тяжёлых карточек": "The library now has a calm editorial layout without emoji, glow effects or heavy card chrome.",
  "Плагин теперь называется Qiaomu Book Reader и поддерживается 向阳乔木; оригинальный Elton Reader указан в благодарностях": "The plugin is now Qiaomu Book Reader, maintained by Qiaomu, with the original Elton Reader credited.",
  "Открыть настройки: шестерёнка Obsidian → «Плагины сообщества» → Qiaomu Book Reader. Вверху шесть вкладок: Чтение, Оформление, Заметки, Перевод, Данные, О плагине.": "Open Obsidian Settings → Community plugins → Qiaomu Book Reader. The six tabs are Reading, Appearance, Notes, Translation, Data and About.",
  "Открывает заметку этой книги рядом с текстом. Если заметки ещё нет, создаёт её автоматически.": "Opens this book's reading note beside the text. If the note does not exist yet, it is created automatically.",
  "Не удалось открыть заметку книги": "Could not open the book note",
  "Язык интерфейса": "Interface language",
  "Откройте настройки плагина → «О плагине» → GitHub Issues.": "Open the plugin settings → About → GitHub Issues.",
  "Каждое сообщение помогает определить, что улучшать дальше.": "Every report helps decide what to improve next.",
  "简体中文现在是新安装和旧版升级后的默认界面语言": "Simplified Chinese is now the default interface for new installs and legacy upgrades.",
  "阅读进度全自动保存，不再显示多余的恢复点与重绘按钮": "Reading progress is saved automatically; the redundant restore-point and redraw buttons are gone.",
  "阅读器新增阅读笔记按钮：没有就创建，已有就在原书旁分屏打开": "The reader now has a reading-note button: it creates the note when needed or opens it beside the book.",
  "自动创建的阅读笔记不再重复显示书名一级标题": "Automatically created reading notes no longer repeat the book title as an H1 heading.",
  "修复旧阅读笔记的重复书名标题迁移": "Fixed migration of duplicate book-title headings in existing reading notes.",
});
// Module-scope, not a global. It was on globalThis/window, which the popout
// guidance rightly flags — but the honest fix is that a module's own setting
// has no business on the window object at all. One value, one place.
let __erLang = "zh";
function __erSetLang(v) { __erLang = v || "zh"; }
function __ertr(s){
  const lang = __erLang || 'ru';
  let out = lang === "zh" && ER_ZH_CN[s] != null
    ? ER_ZH_CN[s]
    : lang === "en" && __erEN[s] != null
      ? __erEN[s]
      : s;
  if (arguments.length>1){ var a=arguments; out = String(out).replace(/\{(\d+)\}/g, function(m,d){ var v=a[(+d)+1]; return v==null?m:v; }); }
  return out;
}
function __erLocale() {
  return __erLang === "en" ? "en-US" : __erLang === "ru" ? "ru-RU" : "zh-CN";
}



const VIEW_TYPE = "elton-reader";
const DEFAULT = {
  // Interface language: "ru", "en" or "zh".
  language: "zh",
  booksFolder: "",
  // ── Notes created from selections / highlights ────────────────────────────
  // Templater template applied to every new note ("" = create without a
  // template, just the quoted selection). Point this at your own template.
  noteTemplate: "",
  // Folder new notes are created in ("" = vault root).
  notesFolder: "",
  // Folder whose notes appear in the per-book "link to note" picker ("" = all).
  bookNotesFolder: "",
  // Optional template used only for the one reading note created for each book.
  // It is deliberately separate from noteTemplate, which belongs to standalone
  // excerpt notes. Reusing that template could turn a reading note into a person,
  // meeting or project note just because the reader used that template elsewhere.
  bookNoteTemplate: "",
  // Opt-in: on a book's first open, automatically create a dedicated note named
  // after the book (in the book-notes folder, else the notes folder) and link it,
  // so every book gets its own note without manual picking. Requested by readers.
  autoBookNote: true,
  // Every new highlight is appended to the book's note as it is made.
  //
  // Deliberately SEPARATE from autoBookNote above. Readers asked for the two to
  // be split: "мне не нужно автоматическое создание заметки, я это делаю через
  // QuickAdd со своим шаблоном — но хочется, чтобы всё, что я выделяю, падало
  // только в эту заметку". One switch decides whether a note is created for you,
  // the other decides where quotes go; tying them together forced a choice
  // neither group wanted.
  quotesToBookNote: true,
  // Where reading data (progress, highlights, rescue backups) is stored.
  // "" = next to the books (the booksFolder). Set it to keep data in one place
  // regardless of where the books live.
  dataFolder: "",
  // Per-book template override, keyed by book path → template path. Lets a
  // given book (or genre) use a different note template than the global one.
  bookTemplates: {},
  // Keep highlight colours when exporting: wraps each quote in a coloured
  // <mark> (renders in vanilla Obsidian). Off = plain quotes without colour.
  exportColors: true,
  // По умолчанию читалка выглядит как сам Obsidian — включая тёмные темы.
  theme: "auto",
  // Библиотека — это интерфейс, а не страница книги: тёмное приложение со светлым
  // каталогом внутри выглядит сломанным, поэтому у неё своя тема и по умолчанию она
  // следует за Obsidian. "reader" — брать ту же тему, что у страницы книги.
  libTheme: "auto",
  fontSize: 18,
  fontFamily: "georgia",
  lineHeight: 1.8,
  columns: "2",
  // Text alignment inside the reading column: "left" (default), "justify",
  // "center" or "right". Requested by readers who prefer a specific alignment.
  textAlign: "left",
  // Where a SHORT page sits vertically: "top" (default), "center" or "bottom".
  // The end of a chapter often fills only part of the page, leaving the text
  // stranded at the top with a large empty band underneath.
  vAlign: "top",
  // Opt-in: adds a "translate" button to the selection popup. Off by default
  // because translating sends the SELECTED FRAGMENT to Google's public endpoint —
  // that has to be a deliberate choice, never a surprise.
  translateEnabled: false,
  // Target language for that button (ISO code Google Translate understands).
  translateTo: "zh-CN",
  // Per-book override for the backlink inserted into notes created from a
  // selection. Keyed by the book file's path → the note name to link to.
  // Empty/unset → fall back to the book file's own name.
  bookNoteLinks: {},
  // Books we've already shown the "pick a book note" prompt for (keyed by path),
  // so first-open asks once and never nags again.
  bookNotePrompted: {},
  // Per-book cover display mode in the library, keyed by path → "contain".
  // Default (no entry) = "cover" (fills the card, may crop). "contain" shows the
  // WHOLE cover in proportion over a soft blurred backdrop.
  coverFits: {},
  // How the user syncs their vault between devices. Progress & highlights are
  // stored AS FILES inside the vault, so they ride whatever sync is in use —
  // this is mostly informational + tunes how aggressively we re-read on open.
  syncMode: "auto",
  // Opt-in: on PDF pages that have BOTH a picture and extractable text, also show
  // the page artwork above the text. Off by default — by default an image is only
  // shown when the page's text can't be extracted (scans, full-page figures), so
  // there is never a screenshot duplicating text you can already read.
  // Pictures on pages that also have text. Was off by default on the theory that
  // people want clean text — but a subscriber had to open illustrated books in a
  // different reader to see whether they contained pictures at all, which is a
  // much worse failure than an occasional redundant image.
  pdfShowFiguresOnTextPages: true,
  // Library cover size = the grid column width in px (cards scale with it). The
  // user can change it live with the −/+ control in the library header.
  libCoverSize: 176,
  // Last category chip picked in the library ("all", "status:reading",
  // "folder:<name>", "tag:<name>"), so it survives reopening.
  libCategory: "all",
  // Is the "Расширенные" group in the reading panel expanded? Collapsed by
  // default so the panel opens showing only the controls used mid-book.
  readerAdvOpen: false,
  readerHistOpen: false,
  askNoteTitle: true,
  shortNoteTitles: true,
  // Colour used when a comment has to create the highlight it hangs on.
  defaultHlColor: "yellow",
  // Reader-assigned categories per book: { "<book path>": ["Психология", …] }.
  // Folders only take you so far — most people keep every book in one place, so
  // this is how a library gets categories without reorganising files on disk.
  bookTags: {},
  // How pages are turned. "buttons" = the ← → arrows / keys / swipe (default).
  // "click" = tap/click the left or right side of the page to turn it (the
  // middle stays neutral so you can still select text / dismiss popups).
  navMode: "buttons",
  // Daily reading-goal timer. Counts active reading time (pauses when you're
  // idle or the book isn't focused) and shows a progress bar toward the goal.
  timerEnabled: true,
  dailyGoalMin: 15,
  // Accumulated reading seconds per day: { "YYYY-MM-DD": seconds }. Kept to the
  // last ~90 days. Local (in data.json) — a personal habit log, not synced.
  readingLog: {},
  // Untrimmed lifetime reading total (seconds). readingLog is capped to ~90 days,
  // so this separate counter is what powers the honest "all-time" total shown to
  // readers who asked to see cumulative reading time.
  lifetimeSeconds: 0,
  // Content-first "immersive" chrome: the top/bottom bars gently dim after a few
  // seconds of no pointer movement, and brighten the instant you move again.
  immersive: true,
  // Ручной отступ сверху на телефоне, px. 0 — высоту статус-бара берём у системы.
  mobileTopInset: 0,
  // Set to true once the first-run welcome slideshow has been shown, so it never
  // pops up again on its own (can still be re-opened from Settings).
  onboarded: false,
  // Set once the stale "already asked" flags from older builds have been cleaned
  // up (see loadAll). Without this the repair would run on every start.
  promptedRepaired: false,
  // One-time repair for older builds that inferred a reading note from any
  // Markdown file carrying a `book` property, including templates/person notes.
  readingNoteLinksRepaired: false,
  figuresShownByDefault: false,
  einkMode: false,
  // Keep the LOOK of the reader separate on each kind of device (see
  // DEVICE_KEYS). Off = one shared appearance everywhere, as before.
  // Where a note made from a highlight opens: "split" beside the book (default,
  // so the book stays on screen), "tab" in a new tab, "none" don't open it.
  // ── AI passage breakdown ──────────────────────────────────────────────────
  // Off by default and stays off until the reader sets it up: it sends the
  // selected passage to whichever service they choose, and that has to be a
  // decision, never a surprise.
  aiEnabled: false,
  aiProvider: "eltonlabs",
  aiKey: "",
  aiModel: "",
  aiBase: "",
  aiInto: "中文",
  // Empty means the built-in instruction. A reader who wants a different kind
  // of answer writes their own here instead of getting the four fixed sections.
  aiSystem: "",
  // Put a link back to the exact paragraph under every exported quote.
  // "pages" (default) or "scroll": one long column the reader scrolls.
  // Set once the reader has chosen a language by hand; until then the plugin
  // follows whatever language Obsidian itself is in.
  languagePicked: false,
  readMode: "pages",
  // Does a page slide when turned? On, and NOT derived from the system's
  // "reduce animations" preference.
  //
  // That preference is respected everywhere it belongs — the card cascade, the
  // pill sliding in, buttons shrinking under a press all stop. But the page
  // turn is not decoration: the slide is what tells you the book moved and in
  // which direction, the same category as a scrollbar moving when you scroll.
  // Deriving it from the OS meant anyone who had switched animations off in
  // Windows — a common thing to do, for reasons that have nothing to do with
  // reading — opened a book that turned pages by teleporting.
  pageTurnAnimation: true,
  // Copy the reading percentage into the book note's frontmatter, so it can be
  // charted and sorted in Bases. Off by default: it writes to a note the reader
  // owns, and that should be asked for.
  progressToFrontmatter: false,
  // How a copied quote is shaped. Placeholders: {text} {book} {page} {link} {comment}
  quoteTemplate: "",
  quoteBacklinks: true,
  // Подпись этой ссылки. Пусто — берётся стандартная на языке интерфейса.
  quoteBacklinkLabel: "",
  noteOpenMode: "split",
  // Widest a single reading column may get, in characters. A full-width column
  // on a wide monitor runs to 150+ characters, and the eye loses the start of
  // the next line — typography puts the comfortable range at 60-90. 0 = off,
  // fill the whole column as before. Extra width becomes side margin, so the
  // page geometry (and therefore the paging stride) is untouched.
  maxLineCh: 0,
  // Put notes made from a book's highlights in the SAME folder as the book,
  // instead of the shared notes folder. Off = the folder setting decides.
  notesNextToBook: false,
  perDevice: false,
  // { desktop: {...}, tablet: {...}, phone: {...} } — only the appearance keys.
  deviceProfiles: {},
  // Plugin version the reader last saw the "what's new" screen for. Drives the
  // post-update summary; empty on an existing install means "never tracked", and
  // the full history is shown once so the jump isn't silent.
  lastSeenVersion: "",
  // После обновления список изменений сохраняется заметкой в хранилище.
  whatsNewNote: true
};
const THEMES = {
  // Цвета самого Obsidian, а не свои: книга и библиотека выглядят как
  // остальное приложение — и меняются вместе с ним, включая чужие темы из каталога.
  // Это ссылки на переменные, а не цвета: браузер разбирает их в момент отрисовки,
  // поэтому переключение темы в Obsidian видно сразу, без перезапуска.
  auto: {
    bg: "var(--background-primary)",
    text: "var(--text-normal)",
    ui: "var(--background-secondary)",
    border: "var(--background-modifier-border)",
    accent: "var(--interactive-accent)",
    muted: "var(--text-muted)",
  },
  // Maximum contrast, no tinting: anything softer turns to mush on an e-ink panel.
  eink: { bg: "#ffffff", text: "#000000", ui: "#ffffff", border: "#000000", accent: "#000000", muted: "#444444" },
  dark: { bg: "#12121a", text: "#ddd8f0", ui: "#1c1c2a", border: "#2e2e45", accent: "#7c6af7", muted: "#6a6880" },
  light: { bg: "#faf8f3", text: "#1a1a2e", ui: "#f0ede5", border: "#ddd9ce", accent: "#5548d9", muted: "#8a8678" },
  sepia: { bg: "#f5efe3", text: "#2c2416", ui: "#ece4d2", border: "#cfc4a8", accent: "#8B6914", muted: "#9a8a68" }
};
// Одно место, где решается, какими цветами рисовать. Режим e-ink сильнее
// выбранной темы, а неизвестное имя темы откатывается к «как в Obsidian»,
// а не к белому листу посреди тёмного приложения.
// Цвета библиотеки. Отдельно от книги: читать можно хоть на сепии, а список
// книг при этом должен выглядеть частью приложения.
function erLibTheme(settings) {
  const s = settings || {};
  const mode = s.libTheme || "auto";
  if (mode === "reader") return erTheme(s);
  if (s.einkMode === true) return THEMES.eink;
  return THEMES[mode] || THEMES.auto;
}
function erTheme(settings) {
  const s = settings || {};
  if (s.einkMode === true) return THEMES.eink;
  return THEMES[s.theme] || THEMES.auto;
}
const READER_FONTS = Object.freeze({
  georgia: {
    id: "georgia",
    stack: "Georgia,'Times New Roman',serif",
    labels: { ru: "Georgia", en: "Georgia", zh: "Georgia 西文衬线" },
  },
  lora: {
    id: "lora",
    stack: "'Lora',Georgia,serif",
    labels: { ru: "Lora", en: "Lora", zh: "Lora 西文衬线" },
  },
  inter: {
    id: "inter",
    stack: "'Inter',system-ui,sans-serif",
    labels: { ru: "Inter", en: "Inter", zh: "Inter 西文黑体" },
  },
  systemSans: {
    id: "systemSans",
    stack: "-apple-system,BlinkMacSystemFont,'PingFang SC','Hiragino Sans GB','Microsoft YaHei','Noto Sans CJK SC','Noto Sans SC',sans-serif",
    labels: { ru: "Системный гротеск", en: "System sans", zh: "系统黑体" },
    cjk: true,
  },
  sourceHanSerif: {
    id: "sourceHanSerif",
    stack: "'Source Han Serif CN','Source Han Serif SC','思源宋体 CN','Noto Serif CJK SC','Noto Serif SC','Songti SC','STSong','SimSun',serif",
    labels: { ru: "Source Han Serif", en: "Source Han Serif", zh: "思源宋体" },
    cjk: true,
  },
  sourceHanSans: {
    id: "sourceHanSans",
    stack: "'Source Han Sans CN','Source Han Sans SC','思源黑体 CN','Noto Sans CJK SC','Noto Sans SC','PingFang SC','Hiragino Sans GB','Microsoft YaHei',sans-serif",
    labels: { ru: "Source Han Sans", en: "Source Han Sans", zh: "思源黑体" },
    cjk: true,
  },
  songti: {
    id: "songti",
    stack: "'Songti SC','STSong','SimSun','Noto Serif CJK SC','Noto Serif SC',serif",
    labels: { ru: "Китайская антиква", en: "CJK serif", zh: "宋体" },
    cjk: true,
  },
  kaiti: {
    id: "kaiti",
    stack: "'Kaiti SC','STKaiti','KaiTi','Noto Serif CJK SC','Songti SC',serif",
    labels: { ru: "Кайти", en: "Kaiti", zh: "楷体" },
    cjk: true,
  },
  lxgw: {
    id: "lxgw",
    stack: "'LXGW WenKai','LXGW WenKai Screen','霞鹜文楷','Songti SC','STSong','Noto Serif CJK SC',serif",
    labels: { ru: "LXGW WenKai", en: "LXGW WenKai", zh: "霞鹜文楷" },
    cjk: true,
  },
});
const FONTS = Object.fromEntries(Object.values(READER_FONTS).map((font) => [font.id, font.stack]));
function erReaderFonts() { return Object.values(READER_FONTS); }
function erFontLabel(font) { return font.labels[__erLang] || font.labels.en; }
// Цвета выделений (полупрозрачные — текст читается на любой теме)
const HL_COLORS = [
  // Keep labels lazy: the plugin language is loaded after module evaluation.
  // Eager translation here would freeze these four names in Russian even when
  // the rest of the interface later switches to Chinese or English.
  { id: "yellow", label: () => __ertr("Жёлтый"), css: "rgba(255,206,64,.45)" },
  { id: "green", label: () => __ertr("Зелёный"), css: "rgba(118,214,108,.42)" },
  { id: "blue", label: () => __ertr("Голубой"), css: "rgba(96,165,250,.42)" },
  { id: "pink", label: () => __ertr("Розовый"), css: "rgba(248,123,168,.42)" }
];
function hlColorCss(id) {
  const c = HL_COLORS.find((x) => x.id === id);
  return c ? c.css : HL_COLORS[0].css;
}
// Every user-supplied or constructed vault path goes through here.
//
// normalizePath() is the Obsidian API's canonicaliser (and what plugin review
// expects on user paths): it turns a hand-typed "0. Files\Books//" into
// "0. Files/Books", so Windows-style backslashes finally just work instead of
// silently pointing nowhere.
//
// The wrapper exists for one reason: normalizePath("") returns "/", while this
// plugin uses "" to mean "not set" (→ vault root / next to the books). Passing
// its "/" onward would make every "if (folder)" check think a folder WAS set.
// So empty stays empty, in both directions.
function erPath(p) {
  const s = String(p == null ? "" : p).trim();
  if (!s) return "";
  try {
    const n = normalizePath(s);
    return n === "/" ? "" : n;
  } catch {
    // Older API surface / unexpected input: fall back to the old hand-rolled trim.
    return s.replace(/\\/g, "/").replace(/\/+/g, "/").replace(/^\/+|\/+$/g, "");
  }
}
// ── Which window are we actually in? ────────────────────────────────────────
// Obsidian can move a leaf into a separate OS window, and that window has its
// own document with its OWN selection. `window.getSelection()` therefore comes
// back empty whenever the reader is living in a popout — which is why selecting
// text there produced no colour palette, and why the reader looked broken in a
// detached window while working fine in a tab.
//
// These take the element whose window we mean, rather than reading the global
// `activeDocument`: that one follows keyboard focus, so it can legitimately
// answer with one document when a listener is added and a different one when
// it is removed, leaking the listener.
// A missing element falls back to the main window, i.e. to the old behaviour.
// ── Per-device appearance ───────────────────────────────────────────────────
// data.json travels with the vault, so one font size was shared by the phone,
// the tablet and the desktop. What reads comfortably on a 27" monitor is tiny
// on a tablet and enormous on a phone, and readers were re-adjusting the size
// every time they switched device.
//
// Only the LOOK is per device. Folders, templates, highlight colours and
// reading progress stay shared — those are decisions about the vault, not about
// the screen you happen to be holding.
const DEVICE_KEYS = ["theme", "fontSize", "fontFamily", "lineHeight", "columns", "textAlign", "vAlign", "einkMode"];
function erDeviceKey() {
  try {
    if (Platform) {
      if (Platform.isPhone) return "phone";
      if (Platform.isTablet) return "tablet";
    }
  } catch { /* optional step; a failure here must not interrupt reading */ }
  return "desktop";
}
// Load this device's saved look over the shared defaults. A key the device has
// never set is left alone, so turning the option on inherits what is on screen
// now rather than resetting the book to factory settings mid-sentence.
function applyDeviceProfile(settings) {
  if (!settings || !settings.perDevice) return;
  const p = (settings.deviceProfiles || {})[erDeviceKey()];
  if (!p) return;
  for (const k of DEVICE_KEYS) if (p[k] !== void 0) settings[k] = p[k];
}
// Stash the live look back into this device's slot on the way to disk. Done at
// save time rather than at each of the ~35 places that read or write a font
// size, so the reader's own code is untouched and there is one place to check.
function captureDeviceProfile(settings) {
  if (!settings || !settings.perDevice) return;
  if (!settings.deviceProfiles) settings.deviceProfiles = {};
  const key = erDeviceKey();
  const p = settings.deviceProfiles[key] || (settings.deviceProfiles[key] = {});
  for (const k of DEVICE_KEYS) p[k] = settings[k];
}
// Put one of our own icons into an element as real SVG nodes.
//
// This was `el.innerHTML = icon(name)` in about forty places. The markup is a
// constant of ours, so nothing could actually be injected through it, but
// assigning innerHTML at all is what a reviewer greps for — and it is one
// careless edit away from being handed something that isn't a constant.
// Parsing instead of assigning removes the question entirely.
function svgIcon(el, name) {
  if (!el) return el;
  el.empty();
  try {
    let markup = icon(name);
    if (!markup) return el;
    // The icons are written as plain `<svg viewBox=…>` with no xmlns, which is
    // fine in HTML but NOT as XML: parsed as image/svg+xml without a namespace
    // the element lands outside the SVG namespace and the browser draws nothing.
    // Every button in the reader came out blank.
    if (!/\sxmlns=/.test(markup)) {
      markup = markup.replace("<svg", '<svg xmlns="http://www.w3.org/2000/svg"');
    }
    const parsed = new DOMParser().parseFromString(markup, "image/svg+xml");
    // A parse failure yields a <parsererror> document instead of throwing.
    if (parsed.getElementsByTagName("parsererror").length) return el;
    const svg = parsed.documentElement;
    if (svg && String(svg.nodeName).toLowerCase() === "svg") {
      el.appendChild(docOf(el).importNode(svg, true));
    }
  } catch { /* an icon is decoration; never let it break the reader */ }
  return el;
}
// Icon followed by a text label — the other shape the old innerHTML calls took.
function iconLabel(el, name, text) {
  svgIcon(el, name);
  el.createSpan({ text });
  return el;
}
// Show the book only once the layout has stopped moving.
//
// "It jumps between two pages when it opens" has been reported four times, and
// every mechanism I found and fixed was real but not the last one. So this stops
// hunting and makes the symptom impossible instead: the curtain (er-booting)
// comes up when the book is built and comes down only after the page area has
// held the same width for a beat. Anything that re-flows in that window — the
// dialog settling, the keyboard leaving, a rotation landing — happens behind it.
// Every call re-arms, so a re-flow that starts late just holds the curtain
// longer rather than revealing a half-finished page.
//
// The cost is a fifth of a second before the text appears. That is worth it: the
// reader sees the page they left, once, instead of watching it change.
const ER_SETTLE_MS = 200;
function erRevealWhenSettled(view) {
  const area = view.areaEl;
  if (!area) return;
  const win = winOf(area);
  win.clearTimeout(view._revealT);
  const width = () => (view.areaEl ? view.areaEl.clientWidth : 0);
  let last = width();
  const check = () => {
    if (!view.areaEl) return;
    const now = width();
    // Still moving — wait for it to settle rather than reveal mid-flight.
    if (now !== last) { last = now; view._revealT = win.setTimeout(check, ER_SETTLE_MS); return; }
    view.areaEl.removeClass("er-booting");
    erHideVeil(view);
  };
  view._revealT = win.setTimeout(check, ER_SETTLE_MS);
}
// Подсветка выделения на телефоне — только в режиме страниц.
//
// Страницы — это многоколоночный поток, сдвинутый трансформом, и WebKit внутри
// такого выделение не рисует: диапазон настоящий (панель появляется, копирование
// работает), но глазу не видно, что ты тянешь. Custom Highlight API красит без
// вмешательства в разметку — менять DOM под живым выделением нельзя, оно
// схлопнется. В прокрутке колонок нет, там система рисует сама, и вторая
// подсветка поверх неё выглядит грязно.
const ER_SEL_HL = "er-selection";
function erPaintSelection(view, range) {
  try {
    if (!erIsMobile(view.app)) return;
    if (view.pager && view.pager.scrollMode) return;
    if (typeof CSS === "undefined" || !CSS.highlights || typeof Highlight !== "function") return;
    CSS.highlights.set(ER_SEL_HL, new Highlight(range.cloneRange()));
  } catch { /* decoration: never let it interrupt selecting */ }
}
function erClearPaintedSelection() {
  try { if (typeof CSS !== "undefined" && CSS.highlights) CSS.highlights.delete(ER_SEL_HL); }
  catch { /* nothing painted is a fine outcome */ }
}
function docOf(el) { return (el && el.ownerDocument) || document; }
function winOf(el) { return docOf(el).defaultView || window; }
function selOf(el) { return winOf(el).getSelection(); }
function icon(n) {
  let _a;
  const m = {
    "arrow-left": `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M19 12H5M12 5l-7 7 7 7"/></svg>`,
    message: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M21 11.5a8.4 8.4 0 0 1-9 8.4 8.5 8.5 0 0 1-3.8-.9L3 21l2-4.2a8.4 8.4 0 0 1-1-4.3 8.4 8.4 0 0 1 8.4-8.4 8.4 8.4 0 0 1 8.6 7.4z"/></svg>`,
    "list": `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><line x1="8" y1="6" x2="21" y2="6"/><line x1="8" y1="12" x2="21" y2="12"/><line x1="8" y1="18" x2="21" y2="18"/><line x1="3" y1="6" x2="3.01" y2="6"/><line x1="3" y1="12" x2="3.01" y2="12"/><line x1="3" y1="18" x2="3.01" y2="18"/></svg>`,
    "sliders": `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><line x1="4" y1="21" x2="4" y2="14"/><line x1="4" y1="10" x2="4" y2="3"/><line x1="12" y1="21" x2="12" y2="12"/><line x1="12" y1="8" x2="12" y2="3"/><line x1="20" y1="21" x2="20" y2="16"/><line x1="20" y1="12" x2="20" y2="3"/><line x1="1" y1="14" x2="7" y2="14"/><line x1="9" y1="8" x2="15" y2="8"/><line x1="17" y1="16" x2="23" y2="16"/></svg>`,
    "chevron-left": `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><path d="M15 18l-6-6 6-6"/></svg>`,
    "chevron-right": `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><path d="M9 18l6-6-6-6"/></svg>`,
    "refresh": `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M23 4v6h-6M1 20v-6h6"/><path d="M3.51 9a9 9 0 0 1 14.85-3.36L23 10M1 14l4.64 4.36A9 9 0 0 0 20.49 15"/></svg>`,
    "highlighter": `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M9 11l-6 6v3h3l6-6"/><path d="M22 12l-4.6 4.6a2 2 0 0 1-2.8 0l-5.2-5.2a2 2 0 0 1 0-2.8L14 4l8 8z"/></svg>`,
    "trash": `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M3 6h18M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/></svg>`,
    "note": `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/><line x1="12" y1="18" x2="12" y2="12"/><line x1="9" y1="15" x2="15" y2="15"/></svg>`,
    "save": `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M19 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11l5 5v11a2 2 0 0 1-2 2z"/><polyline points="17 21 17 13 7 13 7 21"/><polyline points="7 3 7 8 15 8"/></svg>`,
    "download": `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="7 10 12 15 17 10"/><line x1="12" y1="15" x2="12" y2="3"/></svg>`,
    "info": `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"/><line x1="12" y1="16" x2="12" y2="12"/><line x1="12" y1="8" x2="12.01" y2="8"/></svg>`,
    "more": `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="1"/><circle cx="19" cy="12" r="1"/><circle cx="5" cy="12" r="1"/></svg>`,
    "search": `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/></svg>`,
    "qiaomu-library": `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M3.5 5.2c3.2-.8 5.9-.2 8.5 1.7v12.2c-2.6-1.9-5.3-2.5-8.5-1.7z"/><path d="M20.5 5.2c-3.2-.8-5.9-.2-8.5 1.7v12.2c2.6-1.9 5.3-2.5 8.5-1.7z"/><path d="M6.5 9.1c1.1 0 2.1.2 3 .7"/><path d="M17.5 9.1c-1.1 0-2.1.2-3 .7"/></svg>`,
    "cover-fit": `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M8 3H5a2 2 0 0 0-2 2v3M21 8V5a2 2 0 0 0-2-2h-3M3 16v3a2 2 0 0 0 2 2h3M16 21h3a2 2 0 0 0 2-2v-3"/></svg>`,
    "cover-fill": `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="15 3 21 3 21 9"/><polyline points="9 21 3 21 3 15"/><line x1="21" y1="3" x2="14" y2="10"/><line x1="3" y1="21" x2="10" y2="14"/></svg>`,
    // Outline, like every other icon in the selection popup — it was the only
    // filled one, which is why that row looked mismatched.
    "bookmark": `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M19 21l-7-5-7 5V5a2 2 0 0 1 2-2h10a2 2 0 0 1 2 2z"/></svg>`,
    "copy": `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="9" y="9" width="13" height="13" rx="2" ry="2"/><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"/></svg>`,
    "translate": `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M4 5h7M9 3v2c0 4.4-2.2 7-5 8"/><path d="M5 9c0 2.5 2.5 4.5 6 6"/><path d="M12.5 20l4.2-9.5L21 20M14.3 16.2h4.8"/></svg>`,
    "text-quote": `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M17 6H3M21 12H8M21 18H8M3 12v6"/></svg>`,
    "folder-open": `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M6 14l1.5-3.5A2 2 0 0 1 9.3 9H21l-2.6 6.2A2 2 0 0 1 16.6 17H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4l2 3h6a2 2 0 0 1 2 2v1"/></svg>`,
    "close": `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M18 6L6 18M6 6l12 12"/></svg>`,
    // Paper plane: the one icon every chat in the world uses for "send",
    // so nobody has to work out what the round button does.
    "send": `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M22 2L11 13"/><path d="M22 2l-7 20-4-9-9-4z"/></svg>`,
    "sparkles": `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M12 3l1.9 4.6L18.5 9.5 13.9 11.4 12 16l-1.9-4.6L5.5 9.5l4.6-1.9z"/><path d="M18 15l.8 2L21 17.8l-2.2.8-.8 2-.8-2-2.2-.8 2.2-.8z"/></svg>`,
    "play": `<svg viewBox="0 0 24 24" fill="currentColor" stroke="currentColor" stroke-width="1.5" stroke-linejoin="round"><path d="M7 4.5v15a1 1 0 0 0 1.53.85l12-7.5a1 1 0 0 0 0-1.7l-12-7.5A1 1 0 0 0 7 4.5z"/></svg>`,
    "pause": `<svg viewBox="0 0 24 24" fill="currentColor" stroke="none"><rect x="6" y="4.5" width="4.2" height="15" rx="1.4"/><rect x="13.8" y="4.5" width="4.2" height="15" rx="1.4"/></svg>`,
    "check": `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3" stroke-linecap="round" stroke-linejoin="round"><path d="M20 6L9 17l-5-5"/></svg>`,
    "rotate-ccw": `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M1 4v6h6"/><path d="M3.51 15a9 9 0 1 0 2.13-9.36L1 10"/></svg>`,
    "more-horizontal": `<svg viewBox="0 0 24 24" fill="currentColor" stroke="none"><circle cx="5" cy="12" r="1.7"/><circle cx="12" cy="12" r="1.7"/><circle cx="19" cy="12" r="1.7"/></svg>`,
    "x": `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>`,
    "plus": `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round"><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg>`
  };
  return (_a = m[n]) != null ? _a : "";
}
// ── Reading-goal timer + click-to-turn helpers ────────────────────────────────
// Shared by both readers (the desktop ItemView and the mobile full-screen Modal),
// which each expose `plugin`, `areaEl`, `bookHtml`, a nav method, and the goal-bar
// element refs. Keeping this as free functions avoids duplicating the logic twice.
// A page counts as "short" — worth centring — only when this much of it is empty.
// Below the threshold the page is essentially full and must stay put.
const SHORT_PAGE_GAP = 0.35;
// How long a search match stays painted before fading out by itself.
const FOUND_PAINT_MS = 4000;
// Upper bound on per-book commands. Enough for a normal shelf; a 500-book vault
// would otherwise drown every other command in the palette (use "Открыть книгу…").
const MAX_BOOK_COMMANDS = 60;
function readerTodayKey() {
  try { return window.moment ? window.moment().format("YYYY-MM-DD") : new Date().toISOString().slice(0, 10); }
  catch { return new Date().toISOString().slice(0, 10); }
}
// ── Reading statistics ──────────────────────────────────────────────────────
// Pure helpers over the reading log so the stats card can be unit-tested without
// a vault. The log is { "YYYY-MM-DD": seconds } trimmed to ~90 days.

// "2 ч 15 мин" reads better than "135 мин" once someone has been reading a while.
// Below an hour we stay in minutes; a fresh install shows "—" rather than "0 мин",
// which would look like the counter is broken.
function fmtReadTime(sec) {
  const total = Math.max(0, Math.floor(sec || 0));
  if (total < 60) return total > 0 ? __ertr("меньше минуты") : "—";
  const mins = Math.floor(total / 60);
  if (mins < 60) return __ertr("{0} мин", mins);
  const h = Math.floor(mins / 60), m = mins % 60;
  if (h < 24) return m ? __ertr("{0} ч {1} мин", h, m) : __ertr("{0} ч", h);
  const d = Math.floor(h / 24), rh = h % 24;
  return rh ? __ertr("{0} д {1} ч", d, rh) : __ertr("{0} д", d);
}
// Shift a YYYY-MM-DD key by N days without touching the local timezone: parsing
// as UTC noon keeps DST changes from rolling the date backwards.
function shiftDayKey(key, delta) {
  const d = new Date(key + "T12:00:00Z");
  if (isNaN(d.getTime())) return key;
  d.setUTCDate(d.getUTCDate() + delta);
  return d.toISOString().slice(0, 10);
}
// Consecutive days with any reading, counting back from today. Reading yesterday
// but not yet today still counts as a live streak — otherwise the number would
// collapse to 0 every morning and feel punishing.
function readingStreak(log, todayKey) {
  if (!log) return 0;
  const hit = (k) => (log[k] || 0) > 0;
  let cur = todayKey;
  if (!hit(cur)) {
    cur = shiftDayKey(cur, -1);
    if (!hit(cur)) return 0;
  }
  let n = 0;
  while (hit(cur) && n < 4000) { n++; cur = shiftDayKey(cur, -1); }
  return n;
}
// Everything the stats card needs, in one pass.
function readingStats(log, lifetimeSeconds, todayKey) {
  const l = log || {};
  const keys = Object.keys(l);
  const logSum = keys.reduce((a, k) => a + (l[k] || 0), 0);
  const daysRead = keys.filter((k) => (l[k] || 0) > 0).length;
  let best = 0, bestDay = "";
  for (const k of keys) if ((l[k] || 0) > best) { best = l[k]; bestDay = k; }
  // Lifetime is untrimmed and wins, but never report less than the log proves.
  const total = Math.max(lifetimeSeconds || 0, logSum);
  const recent = [];
  for (let i = 13; i >= 0; i--) {
    const k = shiftDayKey(todayKey, -i);
    recent.push({ key: k, sec: l[k] || 0 });
  }
  return {
    total,
    today: l[todayKey] || 0,
    streak: readingStreak(l, todayKey),
    daysRead,
    best, bestDay,
    avgPerDay: daysRead ? Math.round(logSum / daysRead) : 0,
    recent,
  };
}
// The timer is MANUAL: it counts only while the user has pressed ▶ (start), and
// pauses on ⏸. No activity/idle guessing — the reader is in control. Each running
// second is added to today's tally (feeding the daily-goal bar) and to the live
// session counter shown on the toolbar button.
function startTimerSession(view) {
  if (view._timer) return;
  if (!view.plugin.settings.timerEnabled) return;
  view._running = true;
  view._flushAcc = 0;
  view._timer = window.setInterval(() => {
    if (!view.plugin.settings.timerEnabled) { pauseTimerSession(view); return; }
    view.plugin.bumpReadingTime(1);
    view._sessionSec = (view._sessionSec || 0) + 1;
    view._flushAcc = (view._flushAcc || 0) + 1;
    if (view._flushAcc >= 15) { view._flushAcc = 0; view.plugin.flushReadingTime(); }
    updateTimerBtn(view);
    updateGoalBar(view);
    if (!view._goalNotified && view.plugin.getTodaySeconds() >= view.plugin.getGoalSeconds()) {
      view._goalNotified = true;
      view.plugin.flushReadingTime();
      new Notice(__ertr("Цель чтения на сегодня достигнута 🎉"));
    }
  }, 1e3);
  updateTimerBtn(view);
}
function pauseTimerSession(view) {
  if (view._timer) { window.clearInterval(view._timer); view._timer = null; }
  view._running = false;
  if (view.plugin) view.plugin.flushReadingTime();
  updateTimerBtn(view);
}
function toggleTimerSession(view) {
  if (!view.plugin.settings.timerEnabled) {
    new Notice(__ertr("Таймер выключен — включите его в настройках чтения"));
    return;
  }
  view._running ? pauseTimerSession(view) : startTimerSession(view);
}
// Alias kept for the close hooks: stopping the reader just pauses + flushes.
function stopReadingTimer(view) { pauseTimerSession(view); }
// Reset today's reading time to zero (with confirmation).
function resetTimerSession(view) {
  if (!view.plugin.settings.timerEnabled) return;
  pauseTimerSession(view);
  view.plugin.resetTodaySeconds();
  view.plugin.flushReadingTime();
  view._goalNotified = false;
  updateTimerBtn(view);
  updateGoalBar(view);
  new Notice(__ertr("Таймер сброшен"));
}
// Refresh the toolbar timer button. It's a COUNTDOWN toward the daily goal:
// remaining = goal − read-today, shown as m:ss and ticking down while running.
// At 0 it flips to a green "done" state with a check.
function updateTimerBtn(view) {
  if (!view.timerBtnEl) return;
  const s = view.plugin.settings;
  if (!s.timerEnabled) { view.timerBtnEl.addClass("er-hidden"); return; }
  view.timerBtnEl.removeClass("er-hidden");
  const remain = Math.max(0, view.plugin.getGoalSeconds() - view.plugin.getTodaySeconds());
  const done = remain <= 0;
  const mm = Math.floor(remain / 60), ss = remain % 60;
  view.timerBtnEl.classList.toggle("er-timer-run", !!view._running && !done);
  view.timerBtnEl.classList.toggle("er-timer-done", done);
  if (view.timerIconEl) svgIcon(view.timerIconEl, done ? "check" : (view._running ? "pause" : "play"));
  if (view.timerLabelEl) view.timerLabelEl.setText(`${mm}:${String(ss).padStart(2, "0")}`);
}
// Recompute the daily-goal progress bar (fill width + label + "done" glow).
function updateGoalBar(view) {
  if (!view.goalWrapEl) return;
  const s = view.plugin.settings;
  if (!s.timerEnabled) { view.goalWrapEl.addClass("er-hidden"); return; }
  view.goalWrapEl.removeClass("er-hidden");
  const done = view.plugin.getTodaySeconds();
  const goal = view.plugin.getGoalSeconds();
  const pct = Math.min(100, Math.round(done / goal * 100));
  const mins = Math.floor(done / 60);
  view.goalFillEl.style.width = pct + "%";
  const reached = done >= goal;
  view.goalWrapEl.classList.toggle("er-goal-done", reached);
  view.goalTxtEl.setText(reached
    ? __ertr("✓ Цель достигнута — {0} мин сегодня", (mins))
    : __ertr("⏱ {0} из {1} мин · {2}%", (mins), (s.dailyGoalMin || 15), (pct)));
}
// "Click to turn": a click on the left/right third of the page turns it. Returns
// true if it handled the click. Guards against images, highlights and active
// selections so those interactions keep working, and leaves the center neutral.
function handleAreaNavClick(view, e) {
  if ((view.plugin.settings.navMode || "buttons") !== "click") return false;
  // Not while scrolling. Tapping the side of the page to turn it fights a
  // scroller: a finger that stops moving reads as a tap, and the reader jumps a
  // screenful away from where they were reading. The stylesheet already said the
  // side zones are off in this mode; the code did not know.
  if (view.pager && view.pager.scrollMode) return false;
  if (e.target instanceof HTMLElement && e.target.closest("img,.er-hl,.er-hl-popup")) return false;
  const sel = selOf(view.areaEl);
  if (sel && !sel.isCollapsed && sel.toString().trim()) return false;
  const r = view.areaEl.getBoundingClientRect();
  if (!r.width) return false;
  const x = e.clientX - r.left;
  const goNext = () => view.nav ? view.nav("next") : view._nav("next");
  const goPrev = () => view.nav ? view.nav("prev") : view._nav("prev");
  if (x < r.width * 0.32) { goPrev(); return true; }
  if (x > r.width * 0.68) { goNext(); return true; }
  return false;
}
// Add the "Листание" (nav mode) and "Цель чтения" (daily goal) sections to a
// reader's settings panel. Shared by both reader classes.
// The three settings that belong to THIS book. They used to sit inside the
// help dialog, which is a reference screen — editable fields had no business
// being there. Rendered at the end of the reading panel's advanced group.
function buildBookSettings(view, p) {
  if (!view.plugin || !view.file) return;
  // Forget just THIS book, so the setup screen can be tried again without
  // wiping every link in the vault (the settings tab has the "forget all"
  // version). Handy while setting a book up — and the only alternative used to
  // be renaming the file on disk.
  const resetRow = p.createDiv("er-pan-hint");
  const resetLink = resetRow.createSpan({ text: __ertr("Забыть настройки этой книги") });
  resetLink.addClass("er-inline-link");
  resetLink.addEventListener("click", async () => {
    const s = view.plugin.settings;
    const path5 = view.file.path;
    if (s.bookNoteLinks) delete s.bookNoteLinks[path5];
    if (s.bookNotePrompted) delete s.bookNotePrompted[path5];
    if (s.bookTags) delete s.bookTags[path5];
    if (s.bookTemplates) delete s.bookTemplates[path5];
    await view.plugin.saveAll();
    new Notice(__ertr("Настройки книги сброшены — окно появится при следующем открытии"));
  });
      p.createDiv("er-info-group").setText(__ertr("Заметка книги для ссылок"));
      const bnWrap = p.createDiv("er-info-booknote");
      const bnHint = bnWrap.createDiv("er-info-rowdesc");
      bnHint.setText(__ertr("Куда вести ссылку «— из [[…]]» в заметках из выделений. Пусто — имя файла книги."));
      bnHint.addClass("er-panel-hint");
      const bnInput = bnWrap.createEl("input", { type: "text" });
      bnInput.addClass("er-panel-input");
      bnInput.placeholder = view.file ? view.file.basename : __ertr("Сначала откройте книгу…");
      bnInput.disabled = !view.file;
      if (view.file) {
        const map = view.plugin.settings.bookNoteLinks || {};
        bnInput.value = map[view.file.path] || "";
      }
      const saveBookNote = async () => {
        if (!view.file) return;
        if (!view.plugin.settings.bookNoteLinks) view.plugin.settings.bookNoteLinks = {};
        const v = bnInput.value.trim().replace(/^\[\[|\]\]$/g, "").trim();
        if (v) view.plugin.settings.bookNoteLinks[view.file.path] = v;
        else delete view.plugin.settings.bookNoteLinks[view.file.path];
        await view.plugin.saveAll();
        // Mirror it into the note, so the binding is visible in the vault.
        if (v) await writeBookProperty(view.app, v, view.file);
      };
      bnInput.addEventListener("change", saveBookNote);
      bnInput.addEventListener("blur", saveBookNote);
      // Two ways out, side by side — picking an existing note was the only one
      // before, which left readers stuck when the note didn't exist yet.
      const bnActions = bnWrap.createDiv("er-booknote-actions");
      bnActions.addClass("er-panel-actions");
      const bnNew = bnActions.createDiv("er-booknote-pick");
      bnNew.setText(__ertr("+ Создать новую"));
      bnNew.addClass("er-panel-link-strong");
      bnNew.addEventListener("click", async () => {
        if (!view.file) return;
        const folder = bookNotesFolderPath(view.app) || notesFolderPath(view.app) || "";
        const note = await view.plugin.createBookNote(view.file, view.file.basename, folder);
        if (note) {
          bnInput.value = note.basename;
          new Notice(__ertr("Заметка книги создана: {0}", note.basename));
        }
      });
      const bnPick = bnActions.createDiv("er-booknote-pick");
      bnPick.setText(__ertr("Выбрать из списка…"));
      bnPick.addClass("er-panel-link");
      bnPick.addEventListener("click", () => {
        if (!view.file) return;
        const files = bookNoteFiles(view.app);
        if (!files.length) { const bf = bookNotesFolderPath(view.app); new Notice(bf ? __ertr("Нет заметок в «{0}»", (bf)) : __ertr("В хранилище нет заметок")); return; }
        new BookNotePicker(view.app, files, async (chosen) => {
          if (!view.plugin.settings.bookNoteLinks) view.plugin.settings.bookNoteLinks = {};
          view.plugin.settings.bookNoteLinks[view.file.path] = chosen.basename;
          await view.plugin.saveAll();
          await writeBookProperty(view.app, chosen.basename, view.file);
          bnInput.value = chosen.basename;
          new Notice(__ertr("Заметка книги: {0}", (chosen.basename)));
        }).open();
      });

      // ── Category (groups books in the library) ──────────────────────────────
      p.createDiv("er-info-group").setText(__ertr("Категория"));
      const tgWrap = p.createDiv("er-info-booknote");
      const tgHint = tgWrap.createDiv("er-info-rowdesc");
      tgHint.setText(__ertr("Жанр или тема — по ней книги группируются в библиотеке. Несколько — через запятую. Пусто — без категории."));
      tgHint.addClass("er-panel-hint");
      const tgInput = tgWrap.createEl("input", { type: "text" });
      tgInput.addClass("er-panel-input");
      tgInput.placeholder = __ertr("Например: Психология, Бизнес");
      tgInput.disabled = !view.file;
      if (view.file) tgInput.value = bookTagsOf(view.plugin.settings, view.file.path).join(", ");
      const knownTags = allBookTags(view.plugin.settings);
      if (knownTags.length) {
        const dl = tgWrap.createEl("datalist");
        dl.id = "er-info-tags-" + Math.random().toString(36).slice(2, 8);
        knownTags.forEach((t) => dl.createEl("option", { value: t }));
        tgInput.setAttr("list", dl.id);
      }
      const saveTags = async () => {
        if (!view.file) return;
        await view.plugin.setBookTags(view.file.path, parseBookTags(tgInput.value));
      };
      tgInput.addEventListener("change", saveTags);
      tgInput.addEventListener("blur", saveTags);

      // ── Per-book template override ──────────────────────────────────────────
      p.createDiv("er-info-group").setText(__ertr("Шаблон для этой книги"));
      const tpWrap = p.createDiv("er-info-booknote");
      const tpHint = tpWrap.createDiv("er-info-rowdesc");
      tpHint.setText(__ertr("Свой шаблон только для этой книги (например, под жанр). Пусто — используется общий шаблон из настроек плагина."));
      tpHint.addClass("er-panel-hint");
      const tpInput = tpWrap.createEl("input", { type: "text" });
      tpInput.addClass("er-panel-input");
      tpInput.placeholder = (view.plugin.settings.noteTemplate || "").trim() || __ertr("Templates/Шаблон.md");
      tpInput.disabled = !view.file;
      if (view.file) {
        const tmap = view.plugin.settings.bookTemplates || {};
        tpInput.value = tmap[view.file.path] || "";
      }
      const saveBookTemplate = async () => {
        if (!view.file) return;
        if (!view.plugin.settings.bookTemplates) view.plugin.settings.bookTemplates = {};
        const v = tpInput.value.trim();
        if (v) view.plugin.settings.bookTemplates[view.file.path] = v;
        else delete view.plugin.settings.bookTemplates[view.file.path];
        await view.plugin.saveAll();
      };
      tpInput.addEventListener("change", saveBookTemplate);
      tpInput.addEventListener("blur", saveBookTemplate);
      const tpPick = tpWrap.createDiv("er-booknote-pick");
      tpPick.setText(__ertr("Выбрать из списка…"));
      tpPick.addClass("er-panel-link-spaced");
      tpPick.addEventListener("click", () => {
        if (!view.file) return;
        const files = view.app.vault.getMarkdownFiles();
        if (!files.length) { new Notice(__ertr("В хранилище нет заметок")); return; }
        new TemplatePicker(view.app, files, async (chosen) => {
          if (!view.plugin.settings.bookTemplates) view.plugin.settings.bookTemplates = {};
          view.plugin.settings.bookTemplates[view.file.path] = chosen.path;
          await view.plugin.saveAll();
          tpInput.value = chosen.path;
          new Notice(__ertr("Шаблон книги: {0}", (chosen.basename)));
        }).open();
      });
}
// A collapsible section inside the reading panel, styled like "Доп. настройки".
// Returns the body element to fill. The open/closed state is remembered in
// settings under `settingKey` so the panel reopens the way it was left.
// Shared by both readers — the desktop panel and the mobile sheet.
function panelSection(view, p, { label, emoji, settingKey, defaultOpen = false }) {
  const hdr = p.createDiv("er-pan-adv-hdr");
  if (emoji) hdr.createSpan({ cls: "er-pan-adv-ic", text: emoji });
  hdr.createSpan({ cls: "er-pan-adv-lbl", text: label });
  // Collapsed sections hide whether there is anything inside, so the header
  // carries a count that the section's own render fills in.
  const count = hdr.createSpan({ cls: "er-pan-adv-count" });
  const car = hdr.createSpan({ cls: "er-pan-adv-car", text: "›" });
  const wrap = p.createDiv("er-pan-adv");
  // The open/close animation needs exactly ONE child to size against.
  const body = wrap.createDiv("er-pan-adv-body");
  body._erCount = count;
  const stored = view.plugin.settings[settingKey];
  if (stored === void 0 ? defaultOpen : stored) {
    wrap.addClass("er-pan-adv-on");
    car.addClass("er-pan-adv-car-on");
  }
  hdr.addEventListener("click", async () => {
    const on = wrap.hasClass("er-pan-adv-on");
    wrap.toggleClass("er-pan-adv-on", !on);
    car.toggleClass("er-pan-adv-car-on", !on);
    view.plugin.settings[settingKey] = !on;
    // Local-only write: this is a UI preference, not reading data, so it must not
    // trigger the folder/progress machinery that saveAll() drives.
    await view.plugin._saveLocalData();
  });
  return body;
}
function buildReaderExtraSettings(view, p) {
  const s = view.plugin.settings;
  const sec = (l) => p.createDiv("er-pan-sec").setText(l);
  sec(__ertr("Листание"));
  const navRow = p.createDiv("er-col-row");
  [["buttons", __ertr("Кнопками")], ["click", __ertr("По клику")]].forEach(([v, label]) => {
    const btn = navRow.createDiv("er-col-btn");
    btn.setText(label);
    if ((s.navMode || "buttons") === v) btn.addClass("active");
    btn.addEventListener("click", async () => {
      s.navMode = v;
      await view.plugin.saveAll();
      navRow.querySelectorAll(".er-col-btn").forEach((b) => b.removeClass("active"));
      btn.addClass("active");
      (view.contentEl || view.containerEl).classList.toggle("er-navclick", v === "click");
    });
  });
  p.createDiv("er-pan-hint").setText(__ertr("«По клику»: клик по левой части страницы — назад, по правой — вперёд. Центр свободен для выделения текста."));
  sec(__ertr("Выравнивание текста"));
  const alRow = p.createDiv("er-col-row");
  [["left", __ertr("Слева")], ["justify", __ertr("По ширине")], ["center", __ertr("По центру")], ["right", __ertr("Справа")]].forEach(([v, label]) => {
    const btn = alRow.createDiv("er-col-btn");
    btn.setText(label);
    if ((s.textAlign || "left") === v) btn.addClass("active");
    btn.addEventListener("click", async () => {
      s.textAlign = v;
      await view.plugin.saveAll();
      alRow.querySelectorAll(".er-col-btn").forEach((b) => b.removeClass("active"));
      btn.addClass("active");
      if (view.bookHtml && typeof view.repaginate === "function") await view.repaginate();
    });
  });
  sec(__ertr("Положение на странице"));
  const vaRow = p.createDiv("er-col-row");
  [["top", __ertr("Сверху")], ["center", __ertr("По центру")], ["bottom", __ertr("Снизу")]].forEach(([v, label]) => {
    const btn = vaRow.createDiv("er-col-btn");
    btn.setText(label);
    if ((s.vAlign || "top") === v) btn.addClass("active");
    btn.addEventListener("click", async () => {
      s.vAlign = v;
      await view.plugin.saveAll();
      vaRow.querySelectorAll(".er-col-btn").forEach((b) => b.removeClass("active"));
      btn.addClass("active");
      if (view.bookHtml && typeof view.repaginate === "function") await view.repaginate();
      else if (view.bookHtml && typeof view._repaginate === "function") await view._repaginate();
    });
  });
  p.createDiv("er-pan-hint").setText(__ertr("Куда прижимать текст, если страница заполнена не до конца — например, в конце главы."));
  sec(__ertr("Цель чтения"));
  const onRow = p.createDiv("er-col-row");
  const goalStep = p.createDiv("er-sz-row");
  [["on", __ertr("Вкл")], ["off", __ertr("Выкл")]].forEach(([v, label]) => {
    const btn = onRow.createDiv("er-col-btn");
    btn.setText(label);
    const isOn = v === "on";
    if (!!s.timerEnabled === isOn) btn.addClass("active");
    btn.addEventListener("click", async () => {
      s.timerEnabled = isOn;
      await view.plugin.saveAll();
      onRow.querySelectorAll(".er-col-btn").forEach((b) => b.removeClass("active"));
      btn.addClass("active");
      goalStep.style.opacity = isOn ? "1" : ".45";
      updateGoalBar(view);
    });
  });
  const gM = goalStep.createDiv("er-sz-btn"); gM.setText("−");
  const gL = goalStep.createDiv("er-sz-label");
  const gP = goalStep.createDiv("er-sz-btn"); gP.setText("+");
  const setGL = () => gL.setText(__ertr("{0} мин/день", (s.dailyGoalMin || 15)));
  setGL();
  goalStep.style.opacity = s.timerEnabled ? "1" : ".45";
  const chG = async (d) => {
    s.dailyGoalMin = Math.min(180, Math.max(5, (s.dailyGoalMin || 15) + d));
    setGL();
    await view.plugin.saveAll();
    updateGoalBar(view);
  };
  gM.addEventListener("click", () => chG(-5));
  gP.addEventListener("click", () => chG(5));
  const mins = Math.floor(view.plugin.getTodaySeconds() / 60);
  const totalMin = Math.floor(view.plugin.getTotalSeconds() / 60);
  const totalH = Math.floor(totalMin / 60);
  const totalStr = totalH > 0 ? __ertr("{0} ч {1} мин", totalH, totalMin % 60) : __ertr("{0} мин", totalMin);
  p.createDiv("er-pan-hint").setText(__ertr("Сегодня прочитано: {0} мин. Всего за всё время: {1}. Кнопка ▶ вверху запускает обратный отсчёт до цели (пауза — ⏸).", (mins), totalStr));
  buildBookSettings(view, p);
}
function escHtml(s) {
  return s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
}
// Copy text to the clipboard, with a fallback for older/mobile webviews where
// navigator.clipboard may be unavailable or blocked.
async function copyToClipboard(text) {
  if (!text) return false;
  try {
    if (navigator.clipboard && navigator.clipboard.writeText) {
      await navigator.clipboard.writeText(text);
      return true;
    }
  } catch { /* optional step; a failure here must not interrupt reading */ }
  try {
    const ta = activeDocument.createElement("textarea");
    ta.value = text;
    ta.addClass("er-offscreen");
    activeDocument.body.appendChild(ta);
    ta.select();
    const ok = activeDocument.execCommand("copy");
    activeDocument.body.removeChild(ta);
    return ok;
  } catch {
    return false;
  }
}
// Open an image full-screen over everything (works on desktop and the mobile
// modal). Tap the image again to zoom to 100% (then pan); tap the backdrop, the
// ✕, or press Esc to close. Used for illustration pages that are too small to
// read inside a reading column.
function openImageLightbox(src, app, ownerEl) {
  if (!src) return;
  const doc = docOf(ownerEl);
  const ov = doc.createElement("div");
  ov.className = "er-lightbox";
  // Image is a direct flex child centered with margin:auto. Unlike
  // align-items/justify-content:center, margin:auto keeps the top-left edge
  // reachable when the (zoomed) image is larger than the screen, so you can
  // scroll to every part of it.
  const img = ov.createEl("img");
  img.src = src;
  const closeBtn = ov.createDiv("er-lightbox-close");
  closeBtn.setText("✕");
  const hint = ov.createDiv("er-lightbox-hint");
  hint.setText(__ertr("Тап по картинке — увеличить · фон или ✕ — закрыть"));
  let closed = false;
  let scope = null;
  const remove = () => {
    if (closed) return;
    closed = true;
    if (scope && app && app.keymap) { try { app.keymap.popScope(scope); } catch { /* optional step; a failure here must not interrupt reading */ } }
    doc.removeEventListener("keydown", onKey, true);
    ov.remove();
  };
  const onKey = (e) => {
    if (e.key === "Escape") { e.preventDefault(); e.stopPropagation(); if (e.stopImmediatePropagation) e.stopImmediatePropagation(); remove(); }
  };
  // The ONLY reliable way to grab Esc before Obsidian closes the reader/leaf is
  // its own keymap: push a scope so this viewer becomes the active key handler;
  // the Escape handler returns false to stop the event going any further. The
  // capture-phase DOM listener is a belt-and-suspenders fallback.
  if (app && app.keymap && Scope) {
    try {
      scope = new Scope();
      scope.register([], "Escape", () => { remove(); return false; });
      app.keymap.pushScope(scope);
    } catch { scope = null; }
  }
  doc.addEventListener("keydown", onKey, true);
  closeBtn.addEventListener("click", (e) => { e.stopPropagation(); remove(); });
  ov.addEventListener("click", (e) => { if (e.target === ov) remove(); });
  img.addEventListener("click", (e) => { e.stopPropagation(); img.classList.toggle("er-lightbox-zoom"); });
  doc.body.appendChild(ov);
  window.requestAnimationFrame(() => ov.classList.add("er-lightbox-on"));
}
let workerReady = false;
// The pdf.js worker is embedded into this bundle at build time (esbuild replaces
// __PDF_WORKER_CODE__ with the full worker source — see esbuild.config.mjs). We
// hand it to pdf.js as an in-memory Blob URL, so PDFs work fully offline and there
// is no separate pdf.worker.js file to ship. That also makes the plugin installable
// via BRAT, which only downloads main.js / manifest.json / styles.css.
async function setupWorker(app) {
  if (workerReady)
    return;
  try {
    const code = __PDF_WORKER_CODE__;
    if (!code) throw new Error("embedded pdf.worker is empty");
    pdfjsLib.GlobalWorkerOptions.workerSrc = URL.createObjectURL(
      new Blob([code], { type: "application/javascript" })
    );
    workerReady = true;
    return;
  } catch (e) {
    // Запасного пути через CDN здесь нет намеренно: правила каталога запрещают
    // подтягивать код из сети, а воркер и так вшит в сборку. Если он почему-то
    // не поднялся — честно говорим об этом, а не тянем скрипт со стороны.
    console.error("Book Reader: не удалось поднять встроенный pdf.worker", e);
    new Notice(__ertr("Не удалось подготовить чтение PDF. Переустановите плагин."));
  }
  workerReady = true;
}
const EltonReader = class extends Plugin {
  constructor() {
    super(...arguments);
    this.settings = { ...DEFAULT };
    this.progress = {};
    this.thumbCache = {};
    this.highlights = {};
    this.progressBackups = {};
  }
  async onload() {
    await this.loadAll();
    this.registerView(VIEW_TYPE, (leaf) => new ReaderView(leaf, this));
    this.registerView(LIB_VIEW_TYPE, (leaf) => new LibraryView(leaf, this));
    // Quote backlinks. A quote in a note carries an obsidian:// link back to the
    // exact paragraph it came from, so clicking it opens the book there. Using
    // the app's own URI scheme rather than something bespoke means the link
    // works from anywhere a link works — a note, the daily journal, a canvas.
    const openBacklink = (params) => {
      // `block` for a quote, `page` for a note made from a scanned page — the
      // latter has no paragraph to anchor to.
      this.openBookAt(params.book || "", params.block, params.page);
    };
    this.registerObsidianProtocolHandler("qiaomu-book-reader", openBacklink);
    // Keep old exported links working after users migrate from Elton Reader.
    this.registerObsidianProtocolHandler("elton-reader", openBacklink);
    this.registerExtensions(["epub"], VIEW_TYPE);
    // FB2 in its own try/catch for the same reason as PDF below: Obsidian has no
    // built-in handler for it, but another plugin might have claimed it, and that
    // must not take epub down with it.
    try { this.registerExtensions(["fb2"], VIEW_TYPE); }
    catch (e) { console.warn("Elton Reader: could not register .fb2", e); }
    // Also open PDFs in the reader instead of Obsidian's built-in PDF viewer.
    // Separate call in try/catch: if some other plugin already claimed "pdf",
    // we still keep epub working and fall back to the right-click menu for PDFs.
    try { this.registerExtensions(["pdf"], VIEW_TYPE); }
    catch (e) { console.warn(__ertr("Elton Reader: could not register .pdf, use right-click → Открыть в Elton Reader"), e); }
    this.addRibbonIcon(
      "book-open",
      `Qiaomu Book Reader — ${__ertr("\u0411\u0438\u0431\u043B\u0438\u043E\u0442\u0435\u043A\u0430")}`,
      () => this.openLibrary()
    );
    this.addCommand({
      id: "open-library",
      name: __ertr("\u041E\u0442\u043A\u0440\u044B\u0442\u044C \u0431\u0438\u0431\u043B\u0438\u043E\u0442\u0435\u043A\u0443"),
      callback: () => this.openLibrary()
    });
    this.addCommand({
      id: "open-library-window",
      name: __ertr("Открыть библиотеку в отдельном окне"),
      callback: () => this.openLibrary(true)
    });
    this.addCommand({
      id: "open-pdf-reader",
      // Obsidian already prefixes every command with the plugin's name in the
      // palette, so naming the plugin again read as "Book Reader: Open PDF in
      // Book Reader" \u2014 and the directory's rules call that out.
      name: __ertr("\u041E\u0442\u043A\u0440\u044B\u0442\u044C PDF \u0432 \u0447\u0438\u0442\u0430\u043B\u043A\u0435"),
      checkCallback: (checking) => {
        const f = this.app.workspace.getActiveFile();
        if ((f == null ? void 0 : f.extension) === "pdf") {
          if (!checking)
            this.openFile(f);
          return true;
        }
        return false;
      }
    });
    this.addCommand({
      id: "search-in-book",
      name: __ertr("Поиск по книге"),
      checkCallback: (checking) => {
        const view = this.app.workspace.getActiveViewOfType(ReaderView);
        // Also reach the mobile reader, which is a Modal rather than a view.
        const target = (view && view.bookHtml) ? view : (this._openReaderModal || null);
        if (!(target && target.bookHtml)) return false;
        if (!checking) {
          // The two readers name the method differently.
          (target.togglePanel || target._togglePanel).call(target, "find");
          if (target._findInput) erAutoFocus(target._findInput, 80);
        }
        return true;
      }
    });
    this.addCommand({
      id: "export-highlights",
      name: __ertr("Экспортировать выделения в заметки"),
      checkCallback: (checking) => {
        const view = this.app.workspace.getActiveViewOfType(ReaderView);
        if (!(view && view.file)) return false;
        if (!checking) view.exportHighlights();
        return true;
      }
    });
    this.registerEvent(this.app.workspace.on("file-menu", (menu, file) => {
      if (file instanceof TFile && file.extension === "pdf")
        menu.addItem((item) => item.setTitle(__ertr("\u{1F4D6} \u041E\u0442\u043A\u0440\u044B\u0442\u044C \u0432 Book Reader")).setIcon("book-open").onClick(() => this.openFile(file)));
    }));
    this.addSettingTab(new SettingsTab(this.app, this));
    this.addCommand({
      id: "show-onboarding",
      name: __ertr("Показать приветствие (онбординг)"),
      callback: () => new OnboardingModal(this.app, this).open()
    });
    // Jump straight back into whatever was open last — the single most common
    // intent, and it costs one keystroke instead of a trip through the library.
    this.addCommand({
      id: "continue-reading",
      name: __ertr("Продолжить чтение (последняя книга)"),
      checkCallback: (checking) => {
        const f = this.lastReadBookFile();
        if (!f) return false;
        if (!checking) this.openFile(f);
        return true;
      }
    });
    // Type-to-find over every book, for vaults where a command per book would
    // swamp the palette.
    this.addCommand({
      id: "open-book-picker",
      name: __ertr("Открыть книгу…"),
      callback: () => new BookQuickOpen(this.app, this).open()
    });
    // One command per book, so a book can be given its own hotkey. Deferred: at
    // onload the vault index is still filling and getFiles() would miss books.
    this.app.workspace.onLayoutReady(() => {
      this.registerBookCommands();
      // Keep the list honest as books are added, renamed or deleted. Debounced —
      // a sync or a bulk import fires these events in bursts.
      const refresh = () => {
        window.clearTimeout(this._bookCmdTimer);
        this._bookCmdTimer = window.setTimeout(() => this.registerBookCommands(), 1500);
      };
      for (const ev of ["create", "delete", "rename"]) {
        this.registerEvent(this.app.vault.on(ev, (f) => {
          if (f && /^(epub|fb2|pdf)$/.test(f.extension || "")) refresh();
        }));
      }
    });
    // First run: greet the user once with the welcome slideshow, after the
    // workspace is ready so it doesn't fight the initial layout. We persist the
    // "seen" flag BEFORE opening (and await it) — otherwise a re-trigger (e.g. a
    // plugin reload from sync writing data.json) could fire the onboarding a
    // second time before the old close-time flag ever hit disk. A per-session
    // guard covers the rest.
    if (!this.settings.onboarded) {
      this.app.workspace.onLayoutReady(async () => {
        if (this.settings.onboarded || this._onbShown) return;
        this._onbShown = true;
        this.settings.onboarded = true;
        this.settings.lastSeenVersion = this.manifest.version;   // fresh install: nothing to catch up on
        await this.saveAll();
        new OnboardingModal(this.app, this).open();
      });
    } else {
      // Already a user, and the plugin has been updated since they last looked →
      // show what they got. Same "persist before opening" guard as above so a
      // reload can't show it twice.
      this.app.workspace.onLayoutReady(async () => {
        if (this._wnShown) return;
        const seen = this.settings.lastSeenVersion || "";
        const cur = this.manifest.version;
        // Blank means they upgraded from a build that never tracked this; show
        // the history so the jump isn't silent.
        const news = whatsNewSince(seen, cur);
        if (!news.length) {
          if (seen !== cur) { this.settings.lastSeenVersion = cur; await this._saveLocalData(); }
          return;
        }
        this._wnShown = true;
        this.settings.lastSeenVersion = cur;
        await this.saveAll();
        const noteFile = this.settings.whatsNewNote === false
          ? null
          : await writeWhatsNewNote(this.app, this, news);
        new WhatsNewModal(this.app, this, news, noteFile).open();
      });
    }
  }
  async openFile(file) {
    // A dialog on the phone, a tab everywhere else — and the dialog is not a
    // workaround, it is the only shape that works.
    //
    // I tried a leaf here, because the library became one and it fixed the
    // library. On a phone the book came out worse, and for reasons a leaf cannot
    // avoid: Obsidian floats its own header buttons over the top of the content
    // (straight across the reader's title bar and the clock) and puts the mobile
    // navbar over the bottom of it (straight across the page counter). Worse,
    // the workspace keeps the gestures — a swipe left opens the file sidebar
    // instead of turning the page, and a pull down fires the quick action. There
    // is no plugin API to take a gesture back; the request for one is still open
    // on the forum. A modal sits above the workspace and keeps its own touches,
    // which is exactly what a book needs.
    if (this.app.isMobile) {
      new ReaderModal(this.app, this, file).open();
      return;
    }
    const leaves = this.app.workspace.getLeavesOfType(VIEW_TYPE);
    const leaf = leaves.length > 0 ? leaves[0] : this.app.workspace.getLeaf("tab");
    await leaf.setViewState({ type: VIEW_TYPE, state: { path: file.path }, active: true });
    this.app.workspace.revealLeaf(leaf);
  }
  // Open the library. As a tab by default, so it can be docked, split, resized
  // and dragged out into its own window like anything else in Obsidian; in a
  // separate window straight away when asked.
  //
  // On a phone there are no windows and tabs are cramped, so the full-screen
  // dialog stays the right shape there.
  async openLibrary(inNewWindow = false) {
    // A tab on the phone too, not a dialog.
    //
    // As a dialog the library had to fight the platform for every edge: the
    // modal container is positioned against the screen, so the header ran under
    // the status-bar clock, Obsidian's ✕ landed in the same strip at the far
    // corner from a thumb, and the mobile build's own padding showed as bands
    // down both sides. Three rounds of arithmetic went into that and none of it
    // held. As a leaf none of it is ours: Obsidian draws the header, keeps the
    // safe area and provides the way back, exactly as it does for every other
    // plugin's mobile interface. The view already existed for the desktop.
    // Already open somewhere? Go to it instead of opening a second copy.
    const existing = this.app.workspace.getLeavesOfType(LIB_VIEW_TYPE);
    if (existing.length && !inNewWindow) {
      this.app.workspace.revealLeaf(existing[0]);
      return;
    }
    const leaf = inNewWindow && !this.app.isMobile && this.app.workspace.openPopoutLeaf
      ? this.app.workspace.openPopoutLeaf()
      : this.app.workspace.getLeaf("tab");
    await leaf.setViewState({ type: LIB_VIEW_TYPE, active: true });
    this.app.workspace.revealLeaf(leaf);
  }
  // Open a book AND land on a particular paragraph. This is what a quote's
  // backlink resolves to: readers asked to click a quote in their notes and
  // arrive at the page it came from, the way a PDF annotation plugin does.
  //
  // The paragraph index is the same anchor reading progress uses, so it travels
  // between devices and survives a different font size or column count.
  async openBookAt(path, block, page) {
    const file = this.app.vault.getAbstractFileByPath(erPath(path));
    if (!(file instanceof TFile)) {
      new Notice(__ertr("Книга не найдена: {0}", path));
      return;
    }
    await this.openFile(file);
    let idx = Number(block);
    if (!Number.isFinite(idx) || idx < 0) {
      // No paragraph anchor — this came from a scanned page, which carries a
      // page number instead. Resolve it to the first block of that page.
      const pg = Number(page);
      if (!Number.isFinite(pg) || pg < 1) return;
      for (const leaf of this.app.workspace.getLeavesOfType(VIEW_TYPE)) {
        const view = leaf.view;
        if (view && typeof view.jumpToPdfPageWhenReady === "function") {
          view.jumpToPdfPageWhenReady(pg);
          return;
        }
      }
      return;
    }
    // The book is still being laid out at this point; the view exposes the jump
    // so it can be applied once the text exists.
    for (const leaf of this.app.workspace.getLeavesOfType(VIEW_TYPE)) {
      const view = leaf.view;
      if (view && typeof view.jumpToBlockWhenReady === "function") {
        view.jumpToBlockWhenReady(idx);
        return;
      }
    }
  }
  // Folder that holds reading data (progress / highlights / rescue backups):
  // the dedicated "dataFolder" if set, otherwise next to the books (booksFolder).
  _dataFolder() {
    const dedicated = erPath(this.settings.dataFolder);
    if (dedicated) return dedicated;
    return erPath(this.settings.booksFolder);
  }
  // Returns the vault path for the progress JSON file.
  _progressFilePath() {
    const folder = this._dataFolder();
    return erPath(folder ? `${folder}/reading-progress.json` : "reading-progress.json");
  }
  async loadAll() {
    let _a, _b, _c;
    const d = await this.loadData();
    this.settings = { ...DEFAULT, ...(_a = d == null ? void 0 : d.settings) != null ? _a : {} };
    // Overlay whatever THIS device last looked like (no-op unless enabled).
    applyDeviceProfile(this.settings);
    // An older install may carry a null here from a build that derived this
    // from the system preference; treat it as on, which is the default now.
    if (this.settings.pageTurnAnimation === null || this.settings.pageTurnAnimation === void 0) {
      this.settings.pageTurnAnimation = true;
    }
    // Qiaomu Book Reader is Chinese-first. Existing explicit language choices
    // stay untouched; every fresh install and every legacy install that never
    // chose a language starts in Simplified Chinese, regardless of OS locale.
    if (!this.settings.languagePicked) {
      this.settings.language = "zh";
    }
    // Publish the chosen UI language so __ertr() (module-level i18n helper) can read it.
    __erSetLang(this.settings.language);
    // Older builds persisted Russian translation/AI targets even when the user
    // never touched those controls. Move only those untouched legacy defaults
    // to Chinese; any deliberate non-Russian choice remains intact.
    if (!this.settings.chineseDefaultsMigrated) {
      if (this.settings.translateTo === "ru") this.settings.translateTo = "zh-CN";
      if (this.settings.aiInto === "русском") this.settings.aiInto = "中文";
      this.settings.chineseDefaultsMigrated = true;
      await this._saveLocalData();
    }
    // Bump THUMB_VER whenever the thumbnail renderer changes so old (blurry)
    // covers are regenerated once at the new quality instead of lingering.
    // Cover thumbnails live in their OWN local file (thumb-cache.json), kept out
    // of data.json so the synced settings stay tiny and conflict-free. On the
    // first run after this change, migrate the old cache out of data.json.
    await this._loadThumbCache(d);
    this.progressBackups = (d == null ? void 0 : d.progressBackups) != null ? d.progressBackups : {};
    this.highlightsBackups = (d == null ? void 0 : d.highlightsBackups) != null ? d.highlightsBackups : {};
    // Remember the last book's folder across restarts so rescue backups land
    // next to the books even before a book is opened in this session.
    this._lastBookPath = (d == null ? void 0 : d.lastBookPath) || "";
    // Load progress from vault file (syncs via Obsidian Sync)
    this.progress = await this._loadProgressFromVault();
    // Highlights live next to progress so they also sync via Obsidian Sync
    this.highlights = await this._loadHighlightsFromVault();
    // One-time repair. Older builds set "already asked about this book" BEFORE
    // the reader answered — and back then the prompt couldn't create a note at
    // all, and gave up silently when no book-notes folder was configured. Those
    // books can therefore never show the setup screen again, even though the
    // reader was never actually offered anything. Clear the flag wherever no note
    // was linked, so the fixed flow gets exactly one chance. Books that DO have a
    // note are left alone, and from now on the flag is only set on a real answer.
    if (!this.settings.promptedRepaired) {
      const asked = this.settings.bookNotePrompted || {};
      const links = this.settings.bookNoteLinks || {};
      let freed = 0;
      for (const k of Object.keys(asked)) if (!links[k]) { delete asked[k]; freed++; }
      this.settings.promptedRepaired = true;
      // Previously logged how many books were repaired. It ran once per install
      // and told the reader nothing they could act on, so it only added noise to
      // a console other plugins have to share.
      await this._saveLocalData();
    }
    // Older builds treated every note with a matching `book` property as the
    // canonical reading note. That accidentally captured templates and notes
    // such as `type: person`. Remove only those clearly unsafe links; deliberate
    // links to ordinary notes remain untouched.
    if (!this.settings.readingNoteLinksRepaired) {
      const links = this.settings.bookNoteLinks || {};
      const asked = this.settings.bookNotePrompted || {};
      for (const [bookPath, noteName] of Object.entries(links)) {
        const note = resolveBookNote(this.app, noteName);
        if (!note || isUnsafeReadingNote(this.app, note)) {
          delete links[bookPath];
          delete asked[bookPath];
        }
      }
      this.settings.readingNoteLinksRepaired = true;
      await this._saveLocalData();
    }
    // One-time presentation migration: rewrite managed reading-note sections
    // with the icon-only backlink. This updates existing notes immediately on
    // upgrade instead of waiting for the reader to edit every old highlight.
    if (!this.settings.iconBacklinksMigrated && this.settings.quotesToBookNote === true) {
      for (const [bookPath, items] of Object.entries(this.highlights || {})) {
        if (Array.isArray(items) && items.length) {
          await syncHighlightsToReadingNote(this.app, this, bookPath, items);
        }
      }
      this.settings.iconBacklinksMigrated = true;
      await this._saveLocalData();
    }
    // Remove the duplicate H1 only from old auto-generated reading notes. A
    // custom template is untouched unless its first H1 exactly matches the
    // filename and is followed immediately by a reader-managed section.
    if (!this.settings.readingNoteTitlesMigratedV3) {
      const names = new Set(Object.values(this.settings.bookNoteLinks || {}).filter(Boolean));
      for (const name of names) {
        const note = resolveBookNote(this.app, name);
        if (!(note instanceof TFile)) continue;
        const before = await this.app.vault.read(note);
        // Metadata cache may still be empty while the plugin is loading. The
        // linked file is eligible when either the cache or its own frontmatter
        // carries the explicit reading-note marker.
        const markedInText = /^---\s*\n[\s\S]*?\n(?:type:\s*(?:reading-note|book-note)|book-reader-note:\s*true)\s*\n[\s\S]*?\n---(?:\n|$)/im.test(before);
        if (!isMarkedReadingNote(this.app, note) && !markedInText) continue;
        const after = stripGeneratedReadingNoteTitle(before, note.basename);
        if (after !== before) await this.app.vault.modify(note, after);
      }
      this.settings.readingNoteTitlesMigratedV3 = true;
      await this._saveLocalData();
    }
    // One-time migration: turn pictures on for everyone who never chose to hide
    // them. The setting shipped defaulting to OFF, so every existing install has
    // `false` written into data.json without anyone having decided that — and the
    // symptom (illustrated books silently showing no pictures) reads as a bug,
    // not a preference. Runs once; anyone who switches it off afterwards keeps it.
    if (!this.settings.figuresShownByDefault) {
      this.settings.pdfShowFiguresOnTextPages = true;
      this.settings.figuresShownByDefault = true;
      await this._saveLocalData();
    }
    // One-time migration: if old data.json had progress, move it to vault file
    const oldProgress = (_b = d == null ? void 0 : d.progress) != null ? _b : {};
    if (Object.keys(oldProgress).length > 0 && Object.keys(this.progress).length === 0) {
      this.progress = oldProgress;
      await this._saveProgressToVault();
      // Remove from data.json to avoid future confusion
      await this._saveLocalData();
    }
  }
  async saveAll() {
    await this._saveLocalData();
    await this._saveProgressToVault();
  }
  _saveLocalData() {
    captureDeviceProfile(this.settings);
    return this.saveData({ settings: this.settings, progressBackups: this.progressBackups, highlightsBackups: this.highlightsBackups, lastBookPath: this._lastBookPath || "" });
  }
  // ── Cover thumbnail cache (separate, device-local, NOT synced) ─────────────
  _thumbCachePath() { return erPath(`${this.manifest.dir}/thumb-cache.json`); }
  async _loadThumbCache(d) {
    try {
      const p = this._thumbCachePath();
      if (await this.app.vault.adapter.exists(p)) {
        const j = JSON.parse(await this.app.vault.adapter.read(p));
        this.thumbCache = (j && j.ver === 2 && j.cache) ? j.cache : {};
        return;
      }
    } catch (e) { console.warn("Book Reader: thumb cache load failed", e); }
    // Migrate the old in-data.json cache once, then persist to the new file.
    this.thumbCache = ((d == null ? void 0 : d.thumbCacheVer) === 2 && (d == null ? void 0 : d.thumbCache)) ? d.thumbCache : {};
    if (Object.keys(this.thumbCache).length) this._saveThumbCache();
  }
  _saveThumbCache() {
    this._thumbSaveChain = (this._thumbSaveChain || Promise.resolve()).then(
      () => this.app.vault.adapter.write(this._thumbCachePath(), JSON.stringify({ ver: 2, cache: this.thumbCache }))
    ).catch((e) => console.warn("Book Reader: thumb cache save failed", e));
    return this._thumbSaveChain;
  }
  // ── Daily reading-goal timer ───────────────────────────────────────────────
  _todayKey() { return readerTodayKey(); }
  // Add active reading seconds to today's tally (kept in memory; flushed to disk
  // periodically so we don't rewrite data.json every second).
  bumpReadingTime(sec) {
    const s = this.settings;
    if (!s.readingLog) s.readingLog = {};
    const k = this._todayKey();
    s.readingLog[k] = (s.readingLog[k] || 0) + sec;
    s.lifetimeSeconds = (s.lifetimeSeconds || 0) + sec;
    const keys = Object.keys(s.readingLog);
    if (keys.length > 100) { keys.sort(); while (keys.length > 90) delete s.readingLog[keys.shift()]; }
    this._readingDirty = true;
  }
  getTodaySeconds() {
    const s = this.settings;
    return (s.readingLog && s.readingLog[this._todayKey()]) || 0;
  }
  // Sum of every day's reading seconds we still keep (~last 90 days) — shown as a
  // running total in the reading panel and settings. Requested by readers.
  getTotalSeconds() {
    const s = this.settings;
    const logSum = s.readingLog ? Object.keys(s.readingLog).reduce((a, k) => a + (s.readingLog[k] || 0), 0) : 0;
    // Lifetime counter is untrimmed; for users upgrading with existing history it
    // may start behind the 90-day log, so never report less than the log holds.
    return Math.max(s.lifetimeSeconds || 0, logSum);
  }
  // ── Opening books by command ───────────────────────────────────────────────
  // Every readable book in the configured folder (or the whole vault when none
  // is set) — the same rule the library window uses.
  bookFiles() {
    const folder = erPath(this.settings.booksFolder || "");
    const prefix = folder ? folder + "/" : "";
    return this.app.vault.getFiles().filter(
      (f) => (f.extension === "epub" || f.extension === "pdf" || f.extension === "fb2")
        && (prefix === "" || f.path.startsWith(prefix))
    );
  }
  // The book with the most recent reading timestamp, skipping any whose file has
  // since been deleted or renamed.
  lastReadBookFile() {
    const prog = this.progress || {};
    let bestPath = "", bestAt = -1;
    for (const p of Object.keys(prog)) {
      const at = (prog[p] && (prog[p].lastRead || prog[p].updated)) || 0;
      const ts = typeof at === "number" ? at : Date.parse(at) || 0;
      if (ts > bestAt) { bestAt = ts; bestPath = p; }
    }
    if (!bestPath) bestPath = this.settings.lastBookPath || "";
    if (!bestPath) return null;
    const f = this.app.vault.getAbstractFileByPath(bestPath);
    return f && f.extension ? f : null;
  }
  // Register "Book Reader: <title>" for each book so it can be opened directly or
  // bound to a hotkey. Obsidian has no public API for dropping a command, so the
  // ids are tracked and removed through the (undocumented) registry when the list
  // is rebuilt — guarded, since that call is not part of the public API.
  registerBookCommands() {
    const prev = this._bookCmdIds || [];
    for (const id of prev) {
      try { this.app.commands.removeCommand(id); } catch { /* not supported — leave it */ }
    }
    const ids = [];
    const files = this.bookFiles()
      .sort((a, b) => a.basename.localeCompare(b.basename))
      .slice(0, MAX_BOOK_COMMANDS);   // a huge library would otherwise bury every other command
    for (const f of files) {
      const path = f.path;
      const cmd = this.addCommand({
        // Path-derived so the id survives restarts and keeps any assigned hotkey.
        id: "open-book:" + path,
        name: __ertr("Открыть книгу: {0}", f.basename),
        callback: () => {
          const cur = this.app.vault.getAbstractFileByPath(path);
          if (cur) this.openFile(cur);
          else new Notice(__ertr("Книга не найдена: {0}", path));
        }
      });
      if (cmd && cmd.id) ids.push(cmd.id);
    }
    this._bookCmdIds = ids;
  }
  // Auto-create (once) a dedicated note named after the book and link it, so
  // every book gets its own note without manual picking. Opt-in via autoBookNote.
  async ensureBookNote(file) {
    if (!file) return null;
    const s = this.settings;
    if (!s.bookNoteLinks) s.bookNoteLinks = {};
    if (s.bookNoteLinks[file.path]) return null;
    const base = bookNotesFolderPath(this.app) || notesFolderPath(this.app) || "";
    return this.createBookNote(file, file.basename, base);
  }
  // Categories assigned to a book. Stored per book rather than derived from the
  // note, so a book can be filed under a category even without a note.
  async setBookTags(bookPath, tags) {
    const s = this.settings;
    if (!s.bookTags) s.bookTags = {};
    const list = (tags || []).filter(Boolean);
    if (list.length) s.bookTags[bookPath] = list;
    else delete s.bookTags[bookPath];
    await this.saveAll();
  }
  // Create the note for a book and link it. `title` and `folder` come from the
  // setup screen, so the reader can name it and place it wherever they want
  // instead of being stuck with the defaults.
  async createBookNote(file, title, folder) {
    try {
      if (!file) return null;
      const s = this.settings;
      if (!s.bookNoteLinks) s.bookNoteLinks = {};
      const base = erPath(folder);
      const name = sanitizeNoteTitle(title || file.basename);
      // Never overwrite: if that name is taken, link the EXISTING note rather
      // than clobbering someone's file or silently failing.
      const path5 = erPath(base ? `${base}/${name}.md` : `${name}.md`);
      let note = this.app.vault.getAbstractFileByPath(path5);
      if (!(note instanceof TFile)) {
        if (base && !this.app.vault.getAbstractFileByPath(base)) await this.app.vault.createFolder(base).catch(() => {});
        // The note template applies here too. It only ever ran for notes made
        // from a selection, so a reader who had set one up and turned on
        // automatic book notes got a bare heading and no explanation why —
        // "не совсем понял как работают шаблоны, шаблон не был применен".
        // Obsidian already shows the filename as the note title. Repeating it
        // as an H1 makes every reading note look as if it has two titles.
        let body = "";
        const tplPath = bookNoteTemplatePath(this.app);
        const tplFile = tplPath ? this.app.vault.getAbstractFileByPath(tplPath) : null;
        if (tplFile instanceof TFile) {
          try { body = processTemplateManually(await this.app.vault.read(tplFile), name) + "\n\n"; }
          catch { /* a broken template must not stop the note being created */ }
        }
        note = await this.app.vault.create(path5, body).catch((e) => {
          console.error("Elton Reader: create book note failed", e);
          return null;
        });
      }
      if (note instanceof TFile) {
        s.bookNoteLinks[file.path] = note.basename;
        await this.saveAll();
        await writeBookProperty(this.app, note.basename, file);
        return note;
      }
      new Notice(__ertr("Не удалось создать заметку"));
      return null;
    } catch (e) {
      console.error("Elton Reader: create book note failed", e);
      new Notice(__ertr("Не удалось создать заметку"));
      return null;
    }
  }
  resetTodaySeconds() {
    const s = this.settings;
    if (!s.readingLog) s.readingLog = {};
    s.readingLog[this._todayKey()] = 0;
    this._readingDirty = true;
  }
  getGoalSeconds() { return Math.max(60, (this.settings.dailyGoalMin || 15) * 60); }
  flushReadingTime() {
    if (!this._readingDirty) return;
    this._readingDirty = false;
    this._saveLocalData();
  }
  // Keep a rolling local history of reading positions per book (in data.json),
  // so a glitch (e.g. a stray jump to 100%) never loses the real position.
  _recordBackup(path5, prev, now) {
    if (!prev || typeof prev.percent !== "number") return;
    const list = this.progressBackups[path5] || (this.progressBackups[path5] = []);
    const last = list[list.length - 1];
    if (last && last.percent === prev.percent) { last.ts = now; return; }
    list.push({ pct: prev.pct, percent: prev.percent, lastRead: prev.lastRead || now, ts: now });
    if (list.length > 30) list.shift();
  }
  async _loadProgressFromVault() {
    try {
      const path5 = this._progressFilePath();
      const exists = await this.app.vault.adapter.exists(path5);
      if (!exists) return {};
      const raw = await this.app.vault.adapter.read(path5);
      return JSON.parse(raw);
    } catch (e) {
      console.error("Elton Reader: could not load progress file", e);
      return {};
    }
  }
  async _saveProgressToVault() {
    try {
      const path5 = this._progressFilePath();
      const folder = path5.substring(0, path5.lastIndexOf("/"));
      if (folder) {
        const folderExists = await this.app.vault.adapter.exists(folder);
        if (!folderExists) await this.app.vault.createFolder(folder).catch(() => {});
      }
      await this.app.vault.adapter.write(path5, JSON.stringify(this.progress, null, 2));
      this._writeRescue(false);
    } catch (e) {
      console.error("Elton Reader: could not save progress file", e);
    }
  }
  // Safety net: keep a dated copy of progress + highlights + the plugin's own
  // data.json under "<booksFolder>/_reader-rescue-<date>" so a sync glitch can
  // never wipe out highlights for good. Progress saves are throttled
  // (≤ once / 5 min); highlight saves force a write (force=true).
  async _writeRescue(force) {
    try {
      const now = Date.now();
      if (!force && this._lastRescueTs && (now - this._lastRescueTs) < 5 * 60 * 1e3) return;
      this._lastRescueTs = now;
      let date;
      try { date = window.moment ? window.moment().format("YYYY-MM-DD") : new Date().toISOString().slice(0, 10); }
      catch { date = new Date().toISOString().slice(0, 10); }
      const bf = this._dataFolder();
      // Prefer the configured data/books folder. When neither is set, keep the
      // backup next to the last book read (persisted across restarts). If we
      // still don't know any book folder, SKIP the backup entirely rather than
      // dumping a "_reader-rescue" folder at the vault root.
      let base;
      if (bf) {
        base = erPath(`${bf}/_reader-rescue`);
      } else if (this._lastBookPath && this._lastBookPath.includes("/")) {
        const bookDir = this._lastBookPath.slice(0, this._lastBookPath.lastIndexOf("/"));
        base = erPath(`${bookDir}/_reader-rescue`);
      } else {
        return;
      }
      const dir = erPath(`${base}/_reader-rescue-${date}`);
      const ad = this.app.vault.adapter;
      if (!await ad.exists(base)) await this.app.vault.createFolder(base).catch(() => {});
      if (!await ad.exists(dir)) await this.app.vault.createFolder(dir).catch(() => {});
      await ad.write(erPath(`${dir}/reading-progress.json`), JSON.stringify(this.progress, null, 2));
      await ad.write(erPath(`${dir}/reading-highlights.json`), JSON.stringify(this.highlights, null, 2));
      const dataPath = erPath(`${this.manifest.dir}/data.json`);
      if (await ad.exists(dataPath)) await ad.write(erPath(`${dir}/plugin-data.json`), await ad.read(dataPath));
    } catch (e) {
      console.error("Elton Reader: rescue backup failed", e);
    }
  }
  saveProgress(path5, spread, total, block) {
    // Store as 0-1 float so it works across devices with different
    // screen sizes / column counts / font sizes.
    const pct = total > 1 ? spread / (total - 1) : 0;
    const pctDisplay = Math.round(pct * 100);
    const now = Date.now();
    const prev = this.progress[path5];
    // Snapshot the previous position into history on a big jump (≥15%) or
    // roughly every 3 minutes — so we can always roll back to a real spot.
    const bigJump = prev && typeof prev.pct === "number" && Math.abs(pct - prev.pct) >= 0.15;
    const list = this.progressBackups[path5];
    const last = list && list[list.length - 1];
    const periodic = !last || (now - (last.ts || 0)) >= 3 * 60 * 1e3;
    if (bigJump || periodic) this._recordBackup(path5, prev, now);
    this._lastBookPath = path5;
    const entry = { pct, percent: pctDisplay, lastRead: now };
    // Device-independent anchor: global index of the first visible paragraph.
    if (typeof block === "number" && block >= 0) entry.block = block;
    this.progress[path5] = entry;
    const persisted = Promise.all([this._saveProgressToVault(), this._saveLocalData()]);
    this._syncProgressFrontmatter(path5);
    return persisted;
  }
  // Mirror the reading position into the book note's frontmatter.
  //
  // Progress itself lives in a JSON file next to the books, which is right — it
  // is the reader's own bookkeeping and has no business in a note. But a reader
  // pointed out that a number in frontmatter is a number Bases can chart, sort
  // and filter, and there is no other way to get reading progress into a table.
  // So the note gets a COPY: the JSON stays the source of truth, the note gets
  // something to look at.
  //
  // Debounced, because progress is written on every page turn and rewriting a
  // note that often would spam the vault (and any sync watching it).
  _syncProgressFrontmatter(bookPath) {
    if (!this.settings.progressToFrontmatter) return;
    const noteName = bookNoteLinkFor(this, { path: bookPath, basename: "" });
    if (!noteName) return;
    const note = resolveBookNote(this.app, noteName);
    if (!note) return;
    window.clearTimeout(this._fmTimers && this._fmTimers[bookPath]);
    if (!this._fmTimers) this._fmTimers = {};
    this._fmTimers[bookPath] = window.setTimeout(async () => {
      const p = this.progress[bookPath];
      if (!p) return;
      try {
        await this.app.fileManager.processFrontMatter(note, (fm) => {
          fm["reading-progress"] = Math.round((p.pct || 0) * 100);
          fm["reading-updated"] = new Date(p.lastRead || Date.now()).toISOString().slice(0, 10);
        });
      } catch (e) {
        console.warn("Book Reader: could not write progress into the book note", e);
      }
    }, 4000);
  }
  getBackups(path5) {
    const list = this.progressBackups[path5];
    return Array.isArray(list) ? list : [];
  }
  getProgress(path5) {
    let _a;
    return (_a = this.progress[path5]) != null ? _a : null;
  }
  // Returns the spread index for the current device given saved progress.
  getSpreadForTotal(path5, total) {
    const prog = this.getProgress(path5);
    if (!prog) return 0;
    // New format: pct is a 0-1 float
    if (typeof prog.pct === "number") {
      return Math.round(prog.pct * Math.max(0, total - 1));
    }
    // Legacy format: raw spread number (old version) - use as-is
    return typeof prog.spread === "number" ? prog.spread : 0;
  }
  // Re-reads progress from vault file — call before opening a book
  // to get fresh data after Obsidian Sync may have updated the file.
  async refreshProgress() {
    this.progress = await this._loadProgressFromVault();
  }
  // ── Highlights ────────────────────────────────────────
  _highlightsFilePath() {
    const folder = this._dataFolder();
    return erPath(folder ? `${folder}/reading-highlights.json` : "reading-highlights.json");
  }
  async _loadHighlightsFromVault() {
    try {
      const path5 = this._highlightsFilePath();
      const exists = await this.app.vault.adapter.exists(path5);
      if (!exists) return {};
      const raw = await this.app.vault.adapter.read(path5);
      return JSON.parse(raw);
    } catch (e) {
      console.error("Elton Reader: could not load highlights file", e);
      return {};
    }
  }
  async _saveHighlightsToVault() {
    try {
      const path5 = this._highlightsFilePath();
      const folder = path5.substring(0, path5.lastIndexOf("/"));
      if (folder) {
        const folderExists = await this.app.vault.adapter.exists(folder);
        if (!folderExists) await this.app.vault.createFolder(folder).catch(() => {});
      }
      await this.app.vault.adapter.write(path5, JSON.stringify(this.highlights, null, 2));
      this._writeRescue(true);
    } catch (e) {
      console.error("Elton Reader: could not save highlights file", e);
    }
  }
  async refreshHighlights() {
    this.highlights = await this._loadHighlightsFromVault();
  }
  getHighlights(path5) {
    let _a;
    const list = (_a = this.highlights[path5]) != null ? _a : [];
    // Stable reading order: by block, then by position inside block
    return [...list].sort((a, b) => a.block - b.block || a.occ - b.occ);
  }
  addHighlight(path5, hl) {
    if (!this.highlights[path5]) this.highlights[path5] = [];
    this.highlights[path5].push(hl);
    this._persistHighlights(path5, (disk) => {
      if (!disk[path5]) disk[path5] = [];
      if (!disk[path5].some((x) => x.id === hl.id)) disk[path5].push(hl);
    });
  }
  removeHighlight(path5, id) {
    const list = this.highlights[path5];
    if (list) this.highlights[path5] = list.filter((h) => h.id !== id);
    this._persistHighlights(path5, (disk) => {
      if (disk[path5]) disk[path5] = disk[path5].filter((h) => h.id !== id);
    });
  }
  // Attach (or clear) the margin note on a highlight. `id` may be null when the
  // reader commented on a plain selection that was never saved — in that case the
  // matching highlight is found by its text, and if there is none we cannot store
  // anything, so the caller is told nothing happened.
  async setHighlightComment(path5, id, hl, text) {
    const list = this.highlights[path5] || [];
    let target = id ? list.find((x) => x.id === id) : null;
    if (!target && hl && hl.text) target = list.find((x) => x.text === hl.text);
    if (!target) { new Notice(__ertr("Сначала выделите фрагмент цветом")); return false; }
    const value = String(text || "").trim();
    if (value) target.comment = value; else delete target.comment;
    await this._persistHighlights(path5, (disk) => {
      const d = (disk[path5] || []).find((x) => x.id === target.id);
      if (d) { if (value) d.comment = value; else delete d.comment; }
    });
    new Notice(value ? __ertr("Комментарий сохранён") : __ertr("Комментарий удалён"));
    return true;
  }
  setHighlightColor(path5, id, color) {
    const list = this.highlights[path5];
    if (list) {
      const h = list.find((x) => x.id === id);
      if (h) h.color = color;
    }
    this._persistHighlights(path5, (disk) => {
      if (disk[path5]) {
        const h = disk[path5].find((x) => x.id === id);
        if (h) h.color = color;
      }
    });
  }
  // Crash-/sync-safe persistence for incremental highlight edits.
  // Re-reads the on-disk file (which may already contain highlights written by
  // ANOTHER device that this session never loaded) and merges our single change
  // INTO it, so a stale in-memory copy can never clobber newer data via Obsidian
  // Sync. Mutations are serialized through a promise chain to avoid lost updates.
  _persistHighlights(path5, applyFn) {
    this._lastBookPath = path5;
    this._hlChain = (this._hlChain || Promise.resolve()).then(async () => {
      let disk = {};
      try {
        const fp = this._highlightsFilePath();
        if (await this.app.vault.adapter.exists(fp)) {
          disk = JSON.parse(await this.app.vault.adapter.read(fp));
        }
      } catch (e) {
        console.error("Elton Reader: could not re-read highlights, falling back to memory", e);
        disk = JSON.parse(JSON.stringify(this.highlights || {}));
      }
      if (!disk || typeof disk !== "object") disk = {};
      applyFn(disk);
      // Re-add any local highlights the disk copy doesn't have yet (protects
      // rapid successive edits and concurrent local adds from being dropped).
      if (Array.isArray(this.highlights[path5])) {
        if (!disk[path5]) disk[path5] = [];
        const seen = new Set(disk[path5].map((h) => h.id));
        for (const h of this.highlights[path5]) if (!seen.has(h.id)) disk[path5].push(h);
      }
      this.highlights = disk;
      this._backupHighlights(path5, disk[path5] || []);
      await this._saveHighlightsToVault();
      await this._saveLocalData();
      if (this.settings.quotesToBookNote === true) {
        await syncHighlightsToReadingNote(this.app, this, path5, disk[path5] || []);
      }
    }).catch((e) => console.error("Elton Reader: highlight persist failed", e));
    return this._hlChain;
  }
  // Rolling local snapshots of a book's highlights (kept in data.json), so an
  // accidental loss/overwrite can always be restored on this device.
  _backupHighlights(path5, list) {
    if (!this.highlightsBackups) this.highlightsBackups = {};
    const arr = this.highlightsBackups[path5] || (this.highlightsBackups[path5] = []);
    const now = Date.now();
    const sig = list.map((h) => h.id).sort().join(",");
    const last = arr[arr.length - 1];
    if (last && last.sig === sig) { last.ts = now; return; }
    arr.push({ ts: now, count: list.length, sig, items: JSON.parse(JSON.stringify(list)) });
    while (arr.length > 12) arr.shift();
  }
};
const Paginator = class {
  constructor() {
    this.spread = 0;
    this.total = 0;
    this.sw = 0;  // stride per spread in px (float)
  }
  /** Build the paginator. Returns [currentSpread, totalSpreads]. */
  async build(container, html, settings, savedSpread) {
    // Книга уже стоит в этом контейнере и текст тот же — значит перекладка, а не
    // открытие: узлы (и отрисованные страницы PDF вместе с ними) остаются на
    // месте, меняются только геометрия и стили потока.
    const переклад = !!(this.flow && this.clip
      && this.flow.parentElement === this.clip
      && this.clip.parentElement === container
      && this._html === html);
    if (!переклад) container.empty();
    const t = erTheme(settings);
    // Vertical placement is decided per spread from real geometry, so both the
    // setting and the measurements are reset whenever the book is re-laid out.
    this._vAlign = settings.vAlign || "top";
    this._vCache = null;
    this._blockGeom = null;

    // Continuous scrolling instead of pages. Asked for by readers who find they
    // keep going for longer when the text does not stop at a page edge.
    //
    // It is a branch rather than a separate class on purpose: everything that
    // reads a position — progress, the contents list, highlights, search —
    // speaks in spreads and block indices, so the scrolling mode presents the
    // same surface. A "spread" here is one screenful.
    this.scrollMode = (settings.readMode || "pages") === "scroll";
    // Remembered here so applyTransform can honour it on every turn without
    // reaching back into the plugin's settings.
    this.animate = settings.pageTurnAnimation !== false;

    /* 1. Clip — measure real px after one frame */
    this.clip = переклад ? this.clip : container.createDiv("er-clip");
    // NO `overflow` here. It used to be inline, and an inline declaration beats
    // any class without !important — so `.er-clip-scroll { overflow-y: auto }`
    // never applied and scroll mode could not be scrolled with a finger at all.
    // The page-turn buttons still worked, because they move scrollTop from code
    // and overflow does not stop that; which is exactly what it looked like from
    // the outside: "it only pages with buttons or taps". Same trap as the inline
    // `transition:none` that silently killed the page-turn animation. Overflow is
    // decided in the stylesheet: hidden on .er-clip, auto on .er-clip-scroll.
    this.clip.style.cssText = `flex:1;align-self:stretch;position:relative;min-width:0;min-height:0;`;
    if (this.scrollMode) this.clip.addClass("er-clip-scroll");
    await new Promise(r => window.requestAnimationFrame(r));
    await new Promise(r => window.requestAnimationFrame(r));
    // On mobile the view may not have final dimensions yet — wait an extra tick
    if (!container.offsetWidth) await new Promise(r => window.setTimeout(r, 80));
    const aW   = this.clip.offsetWidth  || container.offsetWidth || 390;
    const aH   = this.clip.offsetHeight || container.offsetHeight || 700;
    // The width this layout is ACTUALLY valid for. build() waits a couple of
    // frames before measuring, so by now the area may be a different size than it
    // was when the caller decided to rebuild — during a sidebar animation it
    // usually is. The view must record THIS number, not the one it saw earlier,
    // or the resize observer compares against a width that was never used and
    // concludes nothing needs rebuilding, leaving the page laid out for one width
    // and displayed at another (columns then sit off to the side).
    this.builtWidth = aW;
    const cols  = settings.columns === "2" && aW > 700 ? 2 : 1;
    const gap   = cols === 2 ? 48 : 0;
    // Side padding scales with width: a phone (≤600px) gets a comfortable 26px
    // margin instead of the desktop 60px, so the reading column isn't squeezed.
    const basePad = cols === 2 ? 48 : (aW <= 600 ? 26 : aW <= 820 ? 42 : 60);
    const padVt = Math.min(basePad, 40);
    const padVtBot = padVt;
    // Reduce aH by vertical padding so content fits within column height
    const aHinner = aH - padVt - padVtBot;

    /* 2. Column geometry is DECLARED, not inferred. A column plus the gap that
       follows it is one SLOT, and a spread is exactly `cols` slots — so a slot
       is the visible width over the column count, and the paging stride is that
       number by construction rather than something to be measured back out of
       the layout. CSS places a gap after EVERY column, including the last one
       of a spread, so a column is one gap narrower than its slot.
       Sizing the flow to a whole number of slots is what pins this down:
       `column-width` is only a MINIMUM, so whatever slack is left over in the
       flow width gets handed back to the columns — which is how a 1200px page
       ended up striding 623.94px instead of 600px.
       Splitting the gap in half on both sides of the spread (`left` below)
       keeps the margins even: giving the whole gap to the trailing edge is what
       once left the text sitting 48px from the left and 97px from the right. */
    const slot  = aW / cols;
    const colW  = this.scrollMode ? aW : slot - gap;
    const flowW = this.scrollMode ? aW : 4000 * slot - gap;   /* room for ~4000 columns */

    /* Comfortable line length. On a wide monitor a full-width column runs past
       150 characters and the eye loses its place returning to the next line;
       typography puts the readable range at 60-90. Readers asked for this after
       maximising the window and finding the text unreadable.
       Deliberately spent as PADDING rather than as a narrower column: the slot,
       the column width and therefore the paging stride stay exactly as computed
       above, so nothing about pagination changes — the spare width just becomes
       margin. 0.5em per character is the usual average for a mixed-case serif;
       it does not have to be exact, since this is a comfort limit and not a
       layout constraint. */
    let pad = basePad;
    const maxCh = Number(settings.maxLineCh) || 0;
    if (maxCh > 0) {
      const target = maxCh * (Number(settings.fontSize) || 18) * 0.5;
      if (target > 0 && target < colW - basePad * 2) pad = Math.round((colW - target) / 2);
    }

    /* 3. Flow element */
    this.flow = переклад ? this.flow : this.clip.createDiv("er-flow");
    const chineseTypography = __erLang === "zh" || READER_FONTS[settings.fontFamily]?.cjk === true;
    this.flow.style.cssText = `
      width:${flowW}px;
      /* Scrolling: the text is as tall as it needs to be and the clip scrolls,
         so no column rules apply and the height must not be pinned. */
      ${this.scrollMode ? "height:auto;min-height:100%;" : `height:${aHinner}px;
      column-width:${colW}px;
      column-gap:${gap}px;
      column-fill:auto;`}
      position:relative;
      /* Half a gap on each side of the spread instead of a whole one after it. */
      left:${this.scrollMode ? 0 : gap / 2}px;
      /* Chrome enforces orphans/widows of 2 inside multicol: if only one line of
         the next paragraph fits at the foot of a column, it refuses to split and
         moves the WHOLE paragraph over, stranding several empty lines. Allowing a
         single line to stand lets each column fill to the bottom. */
      orphans:1;
      widows:1;
      padding:${padVt}px 0 ${padVtBot}px;
      box-sizing:content-box;
      margin-top:0;
      font-family:${FONTS[settings.fontFamily]};
      ${chineseTypography ? "font-synthesis-style:none;" : ""}
      font-size:${settings.fontSize}px;
      line-height:${settings.lineHeight};
      color:var(--er-text);
      background:var(--er-bg);
      overflow:hidden;
      user-select:text;
      -webkit-user-select:text;
      will-change:transform;
      /* No transition declared here on purpose: the page-turn animation lives
         in the er-flow-anim class, and an inline transition:none would outrank
         it — which is exactly what silently killed the sliding page turn.
         Until that class is added at the end of build() there is no transition
         anyway, which is what the initial positioning wants. */`;

    /* Padding via <style> so every column (including overflow) gets consistent margins */
    /* The one innerHTML the reader keeps, and deliberately. This is the book
       itself: a whole chapter of markup, rebuilt on every re-layout, where
       building nodes one at a time would cost a visible pause on a long book.
       It is not raw file content — extractEpub / extractFb2 / extractPdf walk
       the parsed document and emit a fixed set of tags they construct
       themselves, running every text run through escHtml() on the way, so
       nothing from the file can arrive here as markup. The <style> block is
       interpolated from our own numbers (font size, padding, theme colours),
       never from anything a book or a reader typed. */
    const markup = `<style>
.er-flow p{text-align:${settings.textAlign || "left"}}
${chineseTypography ? ".er-flow em,.er-flow i,.er-flow cite{font-style:normal}" : ""}
/* Fragmentation. A column must fill to its last line; if the next paragraph
   cannot be split, the whole paragraph jumps to the next column and leaves a
   hole several lines deep. A block becomes MONOLITHIC (unsplittable) as soon as
   it gets break-inside:avoid, contain, or any overflow other than visible — and
   the page wrappers below carry no rules of their own, so whatever the active
   theme applies to a plain <div> decides their fate. Stating it here removes
   that dependency. orphans/widows are repeated on the paragraphs themselves
   rather than relying on inheritance from the flow. */
.er-flow .er-section,.er-flow .er-pdf-page-break{
  display:block;overflow:visible;contain:none;
  break-inside:auto;-webkit-column-break-inside:auto}
.er-flow p,.er-flow li{
  break-inside:auto;-webkit-column-break-inside:auto;orphans:1;widows:1}
.er-flow p,.er-flow h1,.er-flow h2,.er-flow h3,.er-flow h4{
  padding-left:${pad}px;padding-right:${pad}px;margin:0 0 .75em}
.er-flow h1,.er-flow h2,.er-flow h3,.er-flow h4{margin-top:1.1em}
.er-flow>p:first-of-type,.er-flow .er-section:first-child>p:first-child,
.er-flow .er-section:first-child>h1:first-child,.er-flow .er-section:first-child>h2:first-child,
.er-flow .er-section:first-child>h3:first-child{padding-top:${padVt}px}
.er-flow img{max-width:calc(100% - ${pad*2}px);max-height:${aHinner - 12}px;height:auto;width:auto;object-fit:contain;display:block;margin:8px auto;break-inside:avoid;page-break-inside:avoid;-webkit-column-break-inside:avoid}
.er-flow figure{break-inside:avoid;-webkit-column-break-inside:avoid;margin:8px auto}
.er-flow .er-pdf-figure{margin:0 0 .9em;padding:0 ${pad}px;break-inside:avoid;-webkit-column-break-inside:avoid;text-align:center;position:relative}
/* One-click "note from this page" on image/scan pages, where there is no text to
   select and the usual highlight → note route simply doesn't exist. */
.er-flow .er-pdf-note-btn{position:absolute;top:8px;right:${pad + 8}px;width:34px;height:34px;
  display:flex;align-items:center;justify-content:center;padding:6px;cursor:pointer;
  background:var(--er-ui);color:var(--er-text);border:1px solid var(--er-border);border-radius:9px;
  opacity:.55;transition:opacity .15s,transform .15s;z-index:2}
.er-flow .er-pdf-note-btn:hover{opacity:1;transform:scale(1.06)}
.er-flow .er-pdf-note-btn svg{width:18px;height:18px}
.er-flow .er-pdf-page-img{max-width:100%;max-height:${aHinner - 24}px;width:auto;height:auto;object-fit:contain;margin:4px auto;border:1px solid var(--er-border);border-radius:10px;break-inside:avoid;-webkit-column-break-inside:avoid}
/* Program listings (PDF and EPUB): keep line breaks and indentation. Wraps rather
   than scrolls — a horizontal scrollbar has nowhere to live inside a paged column. */
.er-flow pre.er-code{margin:0 0 .85em;padding:.55em .7em;box-sizing:border-box;
  max-width:calc(100% - ${pad * 2}px);margin-left:${pad}px;margin-right:${pad}px;
  white-space:pre-wrap;overflow-wrap:anywhere;tab-size:2;
  font-family:ui-monospace,SFMono-Regular,Consolas,"Liberation Mono",Menlo,monospace;
  font-size:.8em;line-height:1.45;background:var(--er-ui);border:1px solid var(--er-border);
  border-radius:8px;break-inside:avoid;-webkit-column-break-inside:avoid}
.er-flow pre.er-code code{font:inherit;background:none;padding:0;color:inherit}
/* Contents pages: a dot leader must never be justified — stretching it turns the
   entry into a field of dots. Title left, page number right, one row each. */
.er-flow p.er-toc-line{display:flex;align-items:baseline;gap:8px;text-align:left !important;
  margin:0 0 .35em;padding-left:${pad}px;padding-right:${pad}px}
.er-flow p.er-toc-line .er-toc-t{flex:1;min-width:0}
.er-flow p.er-toc-line .er-toc-n{flex:none;opacity:.65;font-variant-numeric:tabular-nums}
/* Notes printed in a book's margin, lifted out of the listing they annotate. */
.er-flow .er-side-notes{margin:.2em ${pad}px .9em;padding:.5em .8em;border-left:2px solid var(--er-border);
  background:color-mix(in srgb,var(--er-text) 4%,transparent);border-radius:0 8px 8px 0;
  break-inside:avoid;-webkit-column-break-inside:avoid}
.er-flow .er-side-notes p{padding:0 !important;margin:0 0 .4em;font-size:.9em;opacity:.85;text-align:left}
.er-flow .er-side-notes p:last-child{margin-bottom:0}
/* Inline identifiers inside prose — malloc(), ptr, --flag. */
.er-flow code{font-family:ui-monospace,SFMono-Regular,Consolas,"Liberation Mono",Menlo,monospace;
  font-size:.86em;background:var(--er-ui);border:1px solid var(--er-border);border-radius:4px;
  padding:0 .28em;overflow-wrap:anywhere}
/* Tables from technical books: readable inside a narrow paged column. */
.er-flow table.er-table{margin:0 ${pad}px .9em;border-collapse:collapse;
  max-width:calc(100% - ${pad * 2}px);font-size:.82em;line-height:1.4;
  break-inside:avoid;-webkit-column-break-inside:avoid}
.er-flow table.er-table th,.er-flow table.er-table td{border:1px solid var(--er-border);
  padding:.3em .5em;text-align:left;vertical-align:top;overflow-wrap:anywhere}
.er-flow table.er-table th{background:var(--er-ui);font-weight:700}
/* End-of-book marker. Empty and invisible; its only job is to be the last thing
   the column layout places, so the column it lands in is the last column the
   book occupies. See the measurement in step 5. */
.er-flow .er-end{display:block;height:0;margin:0;padding:0;border:0;visibility:hidden}
</style>${html}<div class="er-end" aria-hidden="true"></div>`;
    // Ставим книгу разбором и переносом узлов, а не присваиванием innerHTML.
    // Результат тот же, но правила каталога прямо просят не присваивать разметку
    // в innerHTML там, где в неё попадает содержимое файла. Разметка у нас и так
    // своя (см. пояснение выше), однако проверке это не объяснить, а спорить
    // с ней дороже, чем разобрать строку в узлы.
    if (!переклад) {
    const parsed = new DOMParser().parseFromString(markup, "text/html");
    this.flow.empty();
    // ВАЖНО: разбор уносит ведущий <style> в head, а не в body. Первая версия
    // переносила только body — и книга оставалась вообще без своей вёрстки:
    // пропадали отступы (а с ними ограничение ширины строки), выключка и
    // правила разбиения на колонки. Ошибка тихая: книга при этом открывается.
    const узлы = [...Array.from(parsed.head.childNodes), ...Array.from(parsed.body.childNodes)];
    for (const node of узлы) {
      this.flow.appendChild(document.importNode(node, true));
    }
    this._html = html;
    }

    /* 4. Two rAF: first inserts DOM, second completes multicol layout */
    await new Promise(r => window.requestAnimationFrame(r));
    await new Promise(r => window.requestAnimationFrame(r));

    /* 4b. Reserve the box of every lazy figure BEFORE measuring.
       Figures are rendered on demand. Until then the <img> has no src, and with
       `width:auto;height:auto` in the stylesheet its width/height ATTRIBUTES do
       not size it either — so it occupies literally 0×0. Pagination is therefore
       measured as if the book had no pictures at all; then, as the reader pages
       along, renderVisibleFigures() fills each image in, every one suddenly claims
       a couple of hundred pixels, the columns after it re-flow, and the page stops
       matching the offsets measured here. That is the sideways drift that got
       worse the deeper into the book you went, and that "Обновить" could not fix
       (it re-measured with the images blank all over again).
       Sizing the placeholder from the PDF's own dimensions, clamped to the column
       exactly as the stylesheet would, makes loading and unloading a figure a
       purely cosmetic event. */
    const figMaxH = Math.max(40, aHinner - 24);
    for (const img of this.flow.querySelectorAll("img.er-pdf-lazy")) {
      const aw = parseFloat(img.getAttribute("width")) || 0;
      const ah = parseFloat(img.getAttribute("height")) || 0;
      if (!aw || !ah) continue;
      const host = img.parentElement;
      const hostW = host ? host.getBoundingClientRect().width - pad * 2 : colW - pad * 2;
      const maxW = Math.max(40, hostW);
      const scale = Math.min(1, maxW / aw, figMaxH / ah);
      img.style.width = `${Math.round(aw * scale)}px`;
      img.style.height = `${Math.round(ah * scale)}px`;
    }
    await new Promise(r => window.requestAnimationFrame(r));

    /* 5. How many columns the book actually occupies.
          Read off ONE element: the empty marker appended after all the content,
          which the column layout necessarily places in the last column in use.

          What this replaces scanned every p/h1-h4/img and took the rightmost
          edge, and it was wrong twice over. It could not see a list, a code
          listing, a table or a blockquote, so a book whose tail is any of those
          measured as though it ended at its last paragraph — and step (b) then
          cut the flow off there for real, leaving the rest of the book behind a
          wall. Measured in Chrome: a list-heavy book needing 142 spreads showed
          5, one needing 48 showed 2. That is the "book opens with only 14 pages
          and skips whole chunks" report, and it happened in one-column mode too,
          so switching to a single column only ever helped by coincidence.
          It was also a getBoundingClientRect per block, run twice, which is a
          large part of why a 3000-page book took seconds to open. */
    const endEl = this.flow.querySelector(".er-end");
    const measure = () => {
      const fRect = this.flow.getBoundingClientRect();
      let lastX = endEl ? endEl.getBoundingClientRect().right - fRect.left : 0;
      if (lastX <= 0) {
        /* No marker to go by — fall back to the widest block we can find. */
        for (const el of this.flow.querySelectorAll(
          "p,h1,h2,h3,h4,h5,h6,img,li,pre,table,blockquote,figure,dd,dt")) {
          const r = el.getBoundingClientRect().right - fRect.left;
          if (r > lastX) lastX = r;
        }
      }
      return Math.max(1, Math.ceil(lastX / slot));
    };

    /* Scrolling has no columns to count: a "spread" is one screenful, and the
       book is as many of those as its height divides into. Measured from the
       clip's own scroll extent, which is the one number that is always right. */
    if (this.scrollMode) {
      this.sw = aH;
      this.cols = 1;
      this._pitch = aH;
      this._colX = null;
      const viewH = this.clip.clientHeight || aH;
      this.total = Math.max(1, Math.ceil((this.clip.scrollHeight || viewH) / viewH));
      this.spread = Math.max(0, Math.min(savedSpread, this.total - 1));
      this.flow.toggleClass("er-flow-anim", this.animate !== false);
      this.applyTransform(false);
      // Free scrolling has no page turn to hang anything off, so the position
      // has to be picked up from the scroller itself. Without this the progress
      // bar never moved, the place was never saved, and lazy pictures never
      // loaded — the reader would scroll into a book that stayed blank.
      //
      // Debounced: a scroll fires continuously, and re-reading the position on
      // every frame would make the reading itself stutter.
      this.clip.addEventListener("scroll", () => {
        window.clearTimeout(this._scrollT);
        this._scrollT = window.setTimeout(() => {
          const h = this.clip.clientHeight || 1;
          const at = Math.max(0, Math.min(Math.round(this.clip.scrollTop / h), this.total - 1));
          if (at === this.spread) return;
          this.spread = at;
          if (this.onSpreadChange) this.onSpreadChange(at, this.total);
        }, 140);
      }, { passive: true });
      return [this.spread, this.total];
    }

    /* a) count the columns on the roomy layout */
    let nPhys = measure();
    /* b) trim the flow to exactly those columns. The column width is fixed by
          construction, so nothing re-breaks and the count holds still. */
    this.flow.style.width = `${Math.ceil(nPhys * slot) - gap}px`;
    await new Promise(r => window.requestAnimationFrame(r));
    await new Promise(r => window.requestAnimationFrame(r));
    /* c) confirm on the trimmed layout, and never shrink below what was seen */
    nPhys = Math.max(nPhys, measure());

    this.sw = slot * cols;
    this.cols = cols;
    this._pitch = slot;
    // Anchor table: the REAL left offset of each column, keyed by column index.
    //
    // It exists to absorb a drifting stride. When the stride was measured back
    // out of the layout it was a float that could be off by a fraction of a
    // pixel, and multiplying it by the spread number grew that fraction into a
    // ~150px sideways shift by spread 159 — fine at the start of a book, three
    // half-columns deep in. Now that the stride is declared instead of measured
    // the multiplication is exact, so the table is normally not built at all:
    // it costs a getBoundingClientRect per block, which is real time in a long
    // book, and _spreadOffset falls back to spread × stride without it.
    //
    // Verified rather than assumed: the marker sits in the last column of the
    // book, the farthest point from the origin and so where any per-column
    // error would have piled up into its largest value. If it is not where the
    // arithmetic says it should be, the layout is not behaving as declared and
    // the measured table is built after all.
    this._colX = null;
    try {
      const fRect2 = this.flow.getBoundingClientRect();
      const endX = endEl ? endEl.getBoundingClientRect().left - fRect2.left : 0;
      if (endEl && Math.abs(endX - (nPhys - 1) * slot) > 1) {
        this._colX = /* @__PURE__ */ new Map();
        for (const el of this.flow.querySelectorAll("p,h1,h2,h3,h4")) {
          const x = el.getBoundingClientRect().left - fRect2.left;
          const k = Math.round(x / slot);
          // Keep the smallest offset seen for a column: blocks indented by margin
          // (code, tables) sit further right than the column edge.
          if (!this._colX.has(k) || x < this._colX.get(k)) this._colX.set(k, x);
        }
      }
    } catch { this._colX = null; }
    this.total = Math.max(1, Math.ceil(nPhys / cols));
    this.spread = Math.max(0, Math.min(savedSpread, this.total - 1));
    this.flow.toggleClass("er-flow-anim", this.animate !== false);
    this.applyTransform(false);
    return [this.spread, this.total];
  }
  // How far down to nudge the page so a short spread isn't stranded at the top.
  //
  // CSS multi-column can't centre a column's contents, so this measures how much
  // of the page the current spread actually fills and shifts the whole flow by
  // half the leftover. Geometry is cached per spread: it only changes when the
  // book is re-laid out, and reading through a long book would otherwise re-measure
  // thousands of blocks on every page turn.
  _vOffset() {
    const mode = this._vAlign || "top";
    if (mode === "top" || !this.flow) return 0;
    if (!this._vCache) this._vCache = /* @__PURE__ */ new Map();
    if (this._vCache.has(this.spread)) return this._vCache.get(this.spread);
    let off = 0;
    try {
      if (!this._blockGeom) {
        const fRect = this.flow.getBoundingClientRect();
        this._blockGeom = [...this._blocks()].map((el) => {
          const r = el.getBoundingClientRect();
          return { x: r.left - fRect.left, bottom: r.bottom - fRect.top };
        });
      }
      const from = this._spreadOffset(), to = from + this.sw;
      let maxBottom = 0;
      for (const g of this._blockGeom) if (g.x >= from - 2 && g.x < to - 2 && g.bottom > maxBottom) maxBottom = g.bottom;
      const height = this.flow.clientHeight || 0;
      if (maxBottom > 0 && height > 0) {
        const leftover = height - maxBottom;
        // Centre only genuinely short pages — the end of a chapter or of the book.
        // Nudging every ordinary page by its own few leftover pixels is what made
        // the text appear to jump around while paging through a normal chapter.
        if (leftover > height * SHORT_PAGE_GAP) off = mode === "center" ? leftover / 2 : leftover;
      }
    } catch { off = 0; }
    // Whole pixels only: a fractional offset lands glyphs between device pixels
    // and the whole page reads as slightly out of focus.
    off = Math.round(off);
    this._vCache.set(this.spread, off);
    return off;
  }
  // Horizontal offset of the current spread, taken from the measured position of
  // its first column when that column is known. Falls back to stride×index for
  // columns holding no text block (a full-page image, say).
  _spreadOffset() {
    if (this.scrollMode) return this.clip ? this.clip.scrollTop : 0;
    const k = this.spread * (this.cols || 1);
    const exact = this._colX && this._colX.get(k);
    if (typeof exact === "number") return exact;
    // Column with no text block of its own (a full-page figure). Anchor on the
    // nearest column that does have one, so any residual error in the pitch is
    // limited to that short distance instead of accumulating from column zero.
    if (this._colX && this._colX.size) {
      let bestK = null;
      for (const kk of this._colX.keys()) {
        if (bestK === null || Math.abs(kk - k) < Math.abs(bestK - k)) bestK = kk;
      }
      if (bestK !== null) return this._colX.get(bestK) + (k - bestK) * (this._pitch || this.sw / (this.cols || 1));
    }
    return this.spread * this.sw;
  }
  applyTransform(animate = true) {
    if (this.scrollMode) {
      // A screenful at a time, and the browser owns the motion. Smooth scrolling
      // is asked for only when the move was a deliberate jump, not while the
      // reader is dragging — that would fight the finger.
      const viewH = this.clip.clientHeight || 1;
      this.clip.scrollTo({ top: this.spread * viewH, behavior: animate ? "smooth" : "auto" });
      return;
    }
    // Horizontal paging and vertical placement are deliberately carried by two
    // DIFFERENT properties. Both used to live in one `translate(x, y)`, so a page
    // turn animated x and y together and the page visibly slid diagonally toward
    // the corner. `transform` is the only transitioned property; `top` (paint-time
    // offset under position:relative — it does NOT re-flow the columns) applies
    // instantly, so paging is always dead horizontal.
    this.flow.style.top = this._vOffset() + "px";
    // Round to whole pixels: a fractional translate lands glyphs between device
    // pixels and the whole page reads as slightly out of focus.
    const t = `translate3d(${-Math.round(this._spreadOffset())}px, 0, 0)`;
    if (!animate) {
      // Jump rather than slide: drop the animation class, force the layout to
      // settle at the new offset, then put the class back on the next frame so
      // ordinary page turns keep sliding. The forced getBoundingClientRect is
      // what makes the browser apply the class change before the transform.
      this.flow.removeClass("er-flow-anim");
      this.flow.getBoundingClientRect();
      this.flow.style.transform = t;
      window.requestAnimationFrame(() => this.flow.toggleClass("er-flow-anim", this.animate !== false));
    } else {
      this.flow.style.transform = t;
    }
  }
  next() {
    if (this.spread < this.total - 1)
      this.spread++;
    this.applyTransform();
    return [this.spread, this.total];
  }
  prev() {
    if (this.spread > 0)
      this.spread--;
    this.applyTransform();
    return [this.spread, this.total];
  }
  goTo(s, animate = true) {
    this.spread = Math.max(0, Math.min(s, this.total - 1));
    this.applyTransform(animate);
    return [this.spread, this.total];
  }
  // A jump is not a page turn: it must land, not travel. It was an alias for
  // goTo, so restoring the saved position slid the flow from spread 0 all the
  // way to the target — a quarter of a second of pages whipping past, which on
  // a phone reads as the book flickering open. Same for the table of contents,
  // search results and links from a quote: none of them mean "turn the pages".
  jumpTo(s) { return this.goTo(s, false); }
  // ── Content anchor (device-independent reading position) ──────────────
  // All p/h blocks in reading (column-fill) order. The SAME sequence exists on
  // phone and PC, so a block's global index pins the exact reading spot.
  _blocks() { return this.flow ? this.flow.querySelectorAll("p,h1,h2,h3,h4") : []; }
  // First block at or below the top of the visible area, while scrolling.
  // Binary search rather than a walk: on a long book the walk is thousands of
  // rect reads on every scroll settle, and this runs on every saved position.
  _blockIndexAtScroll() {
    const blocks = this._blocks();
    if (!blocks.length || !this.clip) return 0;
    const fTop = this.flow.getBoundingClientRect().top;
    const want = this.clip.scrollTop - 2;
    const topAt = (i) => blocks[i].getBoundingClientRect().top - fTop;
    let lo = 0, hi = blocks.length - 1, ans = 0;
    while (lo <= hi) {
      const mid = (lo + hi) >> 1;
      if (topAt(mid) >= want) { ans = mid; hi = mid - 1; } else lo = mid + 1;
    }
    return ans;
  }
  // Global index of the first block at the current spread's left edge. x grows
  // monotonically with DOM order under column-fill, so binary-search it.
  currentBlockIndex() {
    if (this.scrollMode) return this._blockIndexAtScroll();
    const blocks = this._blocks();
    if (!blocks.length || !this.sw) return 0;
    const fLeft = this.flow.getBoundingClientRect().left;
    // Same anchored offset the transform uses, so "what is on screen" and "where
    // we scrolled to" can never disagree.
    const winLeft = this._spreadOffset() - 2;
    const xat = (i) => blocks[i].getBoundingClientRect().left - fLeft;
    let lo = 0, hi = blocks.length - 1, ans = blocks.length - 1;
    while (lo <= hi) {
      const mid = (lo + hi) >> 1;
      if (xat(mid) >= winLeft) { ans = mid; hi = mid - 1; } else lo = mid + 1;
    }
    return ans;
  }
  // Spread that contains the block with the given global index.
  spreadForBlock(idx) {
    if (this.scrollMode) {
      const blocks = this._blocks();
      if (!blocks.length || idx < 0) return 0;
      const el = blocks[Math.min(idx, blocks.length - 1)];
      const top = el.getBoundingClientRect().top - this.flow.getBoundingClientRect().top;
      const viewH = this.clip.clientHeight || 1;
      return Math.max(0, Math.min(Math.floor(top / viewH), this.total - 1));
    }
    const blocks = this._blocks();
    if (!blocks.length || !this.sw || idx < 0) return 0;
    const el = blocks[Math.min(idx, blocks.length - 1)];
    const x = el.getBoundingClientRect().left - this.flow.getBoundingClientRect().left;
    // Via the column index rather than raw division: the stride is a float, and
    // dividing by it drifts by a whole spread once the error accumulates.
    const k = Math.round(x / (this.sw / (this.cols || 1)));
    return Math.max(0, Math.min(Math.floor(k / (this.cols || 1)), this.total - 1));
  }
  // The block element for the given global index (for the resume flash).
  blockEl(idx) {
    const blocks = this._blocks();
    if (!blocks.length) return null;
    return blocks[Math.min(Math.max(0, idx), blocks.length - 1)] || null;
  }
  get currentSpread() {
    return this.spread;
  }
  get currentPct() {
    return this.total > 1 ? this.spread / (this.total - 1) : 0;
  }
  get totalSpreads() {
    return this.total;
  }
};
async function extractEpub(file, app) {
  const buf = await app.vault.readBinary(file);
  const book = ePub(buf);
  await book.ready;
  const spineItems = book.spine.spineItems;
  const parts = [];
  for (const item of spineItems) {
    try {
      const doc = await item.load(book.load.bind(book));
      const body = doc.querySelector?.("body") ?? doc;
      const imgs = Array.from(body.querySelectorAll?.("img") ?? []);
      for (const img of imgs) {
        const src = img.getAttribute("src");
        if (!src || src.startsWith("data:")) continue;
        try {
          const itemDir = (item.url || "").split("/").slice(0, -1).join("/");
          const resolved = src.startsWith("/") ? src : (itemDir ? itemDir + "/" + src : "/" + src).replace(/\/\.?\//g, "/");
          const dataUrl = await book.archive.getBase64(resolved);
          if (dataUrl) img.setAttribute("src", dataUrl);
        } catch { /* optional step; a failure here must not interrupt reading */ }
      }
      const html = nodeToHtml(body);
      if (html.trim())
        parts.push(`<div class="er-section">${html}</div>`);
      item.unload();
    } catch { /* a chapter that will not parse is skipped, not fatal */ }
  }
  book.destroy();
  return parts.join("\n");
}
// ── Translation ───────────────────────────────────────────────────────────────
// Translate a fragment through Google's public keyless endpoint.
//
// Two deliberate choices:
//  • requestUrl (Obsidian API), not fetch — the reader runs in a renderer where
//    CORS would block this host outright; requestUrl goes through the app.
//  • Chunking — the endpoint silently truncates long input, so a long selection
//    is split on sentence/word boundaries and stitched back together.
//
// This endpoint is free and needs no key, but it's unofficial and rate-limited:
// it is meant for selections, not for translating a whole book.
async function translateText(text, to = "ru") {
  const q = (text || "").replace(/\s+/g, " ").trim();
  if (!q) return "";
  const MAX = 1600;
  const chunks = [];
  let rest = q;
  while (rest.length > MAX) {
    // Prefer a sentence end, else a space; never cut mid-word.
    let cut = rest.lastIndexOf(". ", MAX);
    if (cut < MAX * 0.4) cut = rest.lastIndexOf(" ", MAX);
    if (cut <= 0) cut = MAX; else cut += 1;
    chunks.push(rest.slice(0, cut));
    rest = rest.slice(cut);
  }
  if (rest) chunks.push(rest);
  let out = "";
  for (const chunk of chunks) {
    const url = "https://translate.googleapis.com/translate_a/single?client=gtx&sl=auto"
      + `&tl=${encodeURIComponent(to)}&dt=t&q=${encodeURIComponent(chunk)}`;
    // `throw: false` so the STATUS is visible here. Letting requestUrl throw
    // collapsed every failure into one "you need internet" message, which is
    // what a tablet reader saw while plainly being online: the real answer was
    // Google rate-limiting the free endpoint.
    const res = await requestUrl({ url, method: "GET", throw: false });
    if (res.status === 429 || res.status === 503) {
      const err = new Error("translate rate-limited");
      err.erReason = "limit";
      throw err;
    }
    if (res.status < 200 || res.status >= 300) {
      const err = new Error("translate http " + res.status);
      err.erReason = "http";
      err.erStatus = res.status;
      throw err;
    }
    const data = res.json;
    if (!Array.isArray(data) || !Array.isArray(data[0])) throw new Error("unexpected translate response");
    out += data[0].map((p) => (p && p[0]) || "").join("");
  }
  return out.trim();
}
/* ── Reading a book in a foreign language ──────────────────────────────────
 *
 * Readers described the same routine: copy a passage out of the book, paste it
 * into a chat model, and ask for a translation plus a word-by-word breakdown —
 * why this word and not another, and sometimes where it came from. Then paste
 * the answer back. This does that without leaving the page.
 *
 * Every provider here speaks OpenAI's chat-completions dialect, so a provider
 * is only a base URL, a key and a model name — one request path for all of them.
 *
 * requestUrl, never fetch: a fetch() from a plugin is a browser request and is
 * subject to CORS, and a local Ollama server refuses the app://obsidian.md
 * origin unless the reader sets OLLAMA_ORIGINS by hand. requestUrl is issued by
 * the app itself, so the local option works with no setup — which is the whole
 * reason for offering it.
 */
const AI_PROVIDERS = {
  eltonlabs:  { label: "Elton AI", needsKey: true,  base: "https://api.eltonlabs.org/v1", model: "anthropic/claude-haiku-4.5" },
  openrouter: { label: "OpenRouter", needsKey: true, base: "https://openrouter.ai/api/v1", model: "anthropic/claude-haiku-4.5" },
  openai:     { label: "OpenAI", needsKey: true, base: "https://api.openai.com/v1", model: "gpt-4.1-mini" },
  // Runs on the reader's own machine; nothing leaves the device.
  local:      { label: "Ollama / LM Studio", needsKey: false, base: "http://localhost:11434/v1", model: "qwen2.5:3b" },
};
function aiConfig(settings) {
  const id = settings.aiProvider || "eltonlabs";
  const p = AI_PROVIDERS[id] || AI_PROVIDERS.eltonlabs;
  return {
    id,
    base: (settings.aiBase || p.base).replace(/\/+$/, ""),
    model: settings.aiModel || p.model,
    key: settings.aiKey || "",
    needsKey: p.needsKey,
  };
}
// One instruction for the whole conversation. The breakdown is not a mode of its
// own: it is simply the question most readers ask first, so it is described here
// and sent as an ordinary message.
function aiSystemChat(into) {
  return [
    `You are helping someone read a book in a language they are still learning.`,
    `They send a passage from it and then talk to you about that passage.`,
    `Answer in ${into}. Use Markdown. Be concise — this is read beside the book, not instead of it.`,
    ``,
    `If they ask for разбор (a breakdown) of the passage, give exactly these sections:`,
    `1. **Перевод** — a natural translation of the whole passage, not word-for-word.`,
    `2. **По словам** — a list of only the words and phrases that are genuinely hard`,
    `   (idioms, rare senses, false friends). Skip anything obvious. For each: the word,`,
    `   its meaning HERE, and its dictionary form if that differs.`,
    `3. **Почему так сказано** — the tone, register or construction that a learner`,
    `   would miss: why this wording rather than the plain one. Two or three sentences.`,
    `4. **Откуда слово** — etymology for at most two words, and only where it actually`,
    `   helps remember them. Omit this section entirely if nothing qualifies.`,
    ``,
    `For anything else, just answer what was asked — no fixed sections, and no`,
    `translation of the whole passage unless that is what they asked for.`,
  ].join("\n");
}
// The reader's own instruction replaces the built-in one entirely. The passage
// rides along with their first message, so the model never sees it as an order.
function aiMessages(text, settings, turns, book) {
  const into = settings.aiInto || "中文";
  const own = (settings.aiSystem || "").trim();
  const msgs = [{ role: "system", content: own || aiSystemChat(into) }];
  // Which book this is from, sent quietly with the passage: a page out of context
  // reads very differently from the same page in a book the model knows.
  const from = String(book || "").trim();
  const head = (from ? `Из книги «${from}».\n` : "") + `Фрагмент:\n${text}`;
  turns.forEach((turn, i) => {
    msgs.push(i === 0 && turn.role === "user"
      ? { role: "user", content: `${head}\n\n${turn.content}` }
      : { role: turn.role, content: turn.content });
  });
  return msgs;
}
async function aiExplain(text, settings, turns, book) {
  const cfg = aiConfig(settings);
  if (cfg.needsKey && !cfg.key) {
    const err = new Error("no api key");
    err.erReason = "nokey";
    throw err;
  }
  const headers = { "Content-Type": "application/json" };
  if (cfg.key) headers.Authorization = `Bearer ${cfg.key}`;
  const res = await requestUrl({
    url: `${cfg.base}/chat/completions`,
    method: "POST",
    headers,
    throw: false,
    body: JSON.stringify({
      model: cfg.model,
      messages: aiMessages(text, settings, turns, book),
      temperature: 0.2,
      max_tokens: 900,
    }),
  });
  if (res.status === 401 || res.status === 403) {
    const err = new Error("auth"); err.erReason = "auth"; throw err;
  }
  if (res.status === 429) {
    const err = new Error("rate"); err.erReason = "limit"; throw err;
  }
  if (res.status < 200 || res.status >= 300) {
    const err = new Error("http " + res.status);
    err.erReason = "http";
    err.erStatus = res.status;
    // A local server that is simply not running is the single most likely
    // failure of the local option, and "http 0" explains nothing.
    if (cfg.id === "local") err.erReason = "local";
    throw err;
  }
  const data = res.json;
  let out = data && data.choices && data.choices[0] && data.choices[0].message
    ? String(data.choices[0].message.content || "").trim()
    : "";
  if (!out) { const err = new Error("empty"); err.erReason = "empty"; throw err; }
  return out;
}
// Shows the translation of a selection, with the original kept above it so the
// reader can compare. Actions mirror the popup: copy, or save as a note (the
// note keeps the ORIGINAL quote and puts the translation under it).
const TranslateModal = class extends Modal {
  constructor(app, plugin, text, bookFile) {
    super(app);
    this.plugin = plugin;
    this.text = text;
    this.bookFile = bookFile;
  }
  async onOpen() {
    const c = this.contentEl;
    c.empty();
    c.createEl("h3", { text: __ertr("Перевод") });
    const box = (label) => {
      const w = c.createDiv();
      w.addClass("er-tr-box");
      const l = w.createDiv();
      l.setText(label);
      l.addClass("er-tr-label");
      const b = w.createDiv();
      b.style.cssText = "max-height:180px;overflow:auto;padding:10px 12px;border:1px solid var(--background-modifier-border);"
        + "border-radius:8px;background:var(--background-secondary);line-height:1.55;white-space:pre-wrap;user-select:text";
      return b;
    };
    box(__ertr("Оригинал")).setText(this.text);
    const outEl = box(__ertr("Перевод"));
    outEl.setText(__ertr("Переводим…"));
    let tr = "";
    try {
      tr = await translateText(this.text, this.plugin.settings.translateTo || "zh-CN");
      outEl.setText(tr || __ertr("Пустой ответ переводчика"));
    } catch (e) {
      console.error("Elton Reader: translate failed", e);
      const why = e && e.erReason;
      outEl.setText(
        why === "limit"
          ? __ertr("Google ограничил частые переводы. Подождите минуту и попробуйте снова — это ограничение бесплатного Google Translate, а не вашего интернета.")
          : why === "http"
            ? __ertr("Переводчик ответил ошибкой {0}. Интернет при этом работает — попробуйте позже.", e.erStatus)
            : __ertr("Не удалось связаться с переводчиком. Похоже, нет интернета."));
      return;
    }
    new Setting(c)
      .addButton((b) => b.setButtonText(__ertr("Копировать перевод")).onClick(async () => {
        const ok = await copyToClipboard(tr);
        new Notice(ok ? __ertr("Скопировано ✓") : __ertr("Не удалось скопировать"));
      }))
      .addButton((b) => b.setButtonText(__ertr("В заметку")).setCta().onClick(async () => {
        // The note keeps the original as the quote (that's what's citable) and
        // adds the translation beneath it.
        await createNoteFromSelection(this.app, this.plugin, this.text, this.bookFile, {
          open: false, silent: true, extra: __ertr("\n\n**Перевод:**\n{0}", tr)
        });
        new Notice(__ertr("Заметка создана"));
        this.close();
      }));
  }
  onClose() { this.contentEl.empty(); }
};
// Is the reader running on a phone/tablet? Platform is the modern API; app.isMobile
// is the long-standing fallback, so a missing Platform never breaks the reader.
// Книга раскладывается не мгновенно, а шторка (er-booting) прячет полуготовую
// разметку — на телефоне это несколько секунд пустого экрана, по которому не понять,
// зависла книга или плагин. Вместо пустоты — скелет страницы с мягким мерцанием:
// видно, что работа идёт. Вешается на корень читалки, потому что саму область
// вёрстка по дороге очищает.
function erShowVeil(view, text) {
  const host = view && view.areaEl && view.areaEl.parentElement;
  if (!host) return;
  erHideVeil(view);
  const veil = host.createDiv("er-veil");
  const sk = veil.createDiv("er-veil-skel");
  for (let i = 0; i < 8; i++) sk.createDiv("er-veil-line");
  veil.createDiv({ cls: "er-veil-text", text: text || __ertr("Раскладываем страницы…") });
  view._veil = veil;
}
function erHideVeil(view) {
  if (view && view._veil) {
    view._veil.remove();
    view._veil = null;
  }
}
// Автофокус — только там, где есть настоящая клавиатура.
//
// На телефоне `.focus()` в поле поднимает экранную клавиатуру, и она закрывает
// половину окна: у вопроса «завести заметку книги?» под ней оказались обе
// кнопки, а окно разговора встречало клавиатурой вместо текста. Спрятать её из
// плагина нечем — в вебвью нет такого API, единственный способ не мешать
// читателю это не забирать фокус самим. По тапу в поле всё работает как всегда.
// Тап мимо поля убирает клавиатуру.
//
// Так ведёт себя любой мессенджер, и именно этого не хватало: на телефоне
// клавиатура остаётся висеть, пока у поля есть фокус, а спрятать её из вебвью
// можно ровно одним способом — снять фокус. Слушаем pointerdown, а не click:
// клавиатура должна уходить в тот же момент, когда палец коснулся экрана.
function erBlurOnTapOutside(root, field) {
  if (!root || !field) return;
  root.addEventListener("pointerdown", (e) => {
    const t = e.target;
    if (t === field) return;
    // Своя строка ввода (поле + кнопка отправки) не считается «мимо»: нажатие
    // на «отправить» не должно закрывать клавиатуру раньше самой отправки.
    if (t instanceof HTMLElement && t.closest(".er-ai-bar, .er-find-bar, input, textarea")) return;
    if (docOf(field).activeElement === field) field.blur();
  });
}
function erAutoFocus(el, delayMs) {
  if (!el || erIsMobile()) return;
  if (delayMs) window.setTimeout(() => { try { el.focus(); } catch { /* optional step; a failure here must not interrupt reading */ } }, delayMs);
  else { try { el.focus(); } catch { /* optional step; a failure here must not interrupt reading */ } }
}
function erIsMobile(app) {
  try {
    if (Platform && typeof Platform.isMobile === "boolean") return Platform.isMobile;
  } catch { /* optional step; a failure here must not interrupt reading */ }
  return !!(app && app.isMobile);
}
// Place the highlight bar.
//
// On mobile it is DOCKED to the bottom of the reader rather than floated over the
// selection: Android/iOS draw their own selection toolbar (copy / share / select
// all) directly above the selected text, as an OS-level layer that always wins.
// Ours used to land in exactly that spot and was permanently hidden behind it.
// On desktop there is no such toolbar, so the bar stays next to the selection.
function positionHlPopup(view, rect, fallbackW, fallbackH) {
  const pop = view.hlPopup;
  const root = view.contentEl;
  if (erIsMobile(view.app)) {
    // Docked rather than floated: Android and iOS draw their own selection
    // toolbar (copy / share / select all) directly over the selection, as an
    // OS layer that always wins, and ours used to land underneath it.
    //
    // Which edge it docks to is chosen per selection. Always docking to the
    // bottom left it half a screen away on a tablet — a reader said he did not
    // even notice it had appeared. Docking to the edge FURTHEST from the
    // selection keeps it clear of the OS toolbar while staying in view.
    // Just BELOW the selection, not pinned to the bottom of the screen.
    //
    // Both extremes were wrong. Floating it over the selection buried it under
    // the OS toolbar; pinning it to the bottom edge put it a whole page away
    // from what you had just selected. Below the selection is the one place
    // that is neither: Android and iOS put their own toolbar ABOVE the
    // selection, so the space underneath is free, and the bar appears where the
    // eye already is.
    const rootRect = root.getBoundingClientRect();
    const barH = pop.offsetHeight || fallbackH || 92;
    const barW = pop.offsetWidth || fallbackW || 260;
    // Keep clear of the page controls at the foot of the reader.
    const bottomLimit = rootRect.height - barH - 74;
    const hasRect = rect && rect.height;
    let top = hasRect ? rect.bottom - rootRect.top + 12 : bottomLimit;
    // No room underneath (selection near the foot of the page) — go above it
    // instead, which on that part of the screen is where the OS toolbar is not.
    if (top > bottomLimit) {
      const above = (hasRect ? rect.top - rootRect.top : 0) - barH - 12;
      top = above > 8 ? above : Math.max(8, bottomLimit);
    }
    pop.classList.add("er-hl-popup-docked");
    pop.style.removeProperty("bottom");
    pop.style.top = `${Math.round(Math.max(8, top))}px`;
    // Centred on the selection, then kept inside the page.
    const wantLeft = hasRect
      ? rect.left - rootRect.left + rect.width / 2 - barW / 2
      : (rootRect.width - barW) / 2;
    pop.style.left = `${Math.round(Math.max(8, Math.min(wantLeft, rootRect.width - barW - 8)))}px`;
    return;
  }
  pop.classList.remove("er-hl-popup-docked");
  const rootRect = root.getBoundingClientRect();
  const pw = pop.offsetWidth || fallbackW, ph = pop.offsetHeight || fallbackH;
  let left = rect.left - rootRect.left + rect.width / 2 - pw / 2;
  let top = rect.top - rootRect.top - ph - 10;
  if (top < 4) top = rect.bottom - rootRect.top + 10;
  left = Math.max(6, Math.min(left, root.clientWidth - pw - 6));
  // В режиме прокрутки выделенный абзац может оказаться выше или ниже видимой
  // части: без ограничения панель уезжала на тысячи пикселей за экран и просто
  // «пропадала». Держим её внутри области чтения при любом положении текста.
  top = Math.max(6, Math.min(top, rootRect.height - ph - 6));
  pop.style.left = `${left}px`;
  pop.style.top = `${top}px`;
}
// Wire up the per-page "note" buttons that sit on image/scan pages. Shared by
// both readers. Click → a note for that page, linked back to the book, with the
// page's text as the quote when the PDF has a text layer (on a true scan there
// is none, so the note opens ready for the reader's own words).
function bindPdfNoteButtons(view) {
  const flow = view.pager && view.pager.flow;
  if (!flow) return;
  flow.querySelectorAll("button.er-pdf-note-btn").forEach((btn) => {
    if (btn.dataset.bound === "1") return;
    btn.dataset.bound = "1";
    // The reader turns pages on click in "click" nav mode — this button must not
    // count as a page turn, nor start a text selection.
    btn.addEventListener("mousedown", (e) => { e.stopPropagation(); e.preventDefault(); });
    btn.addEventListener("click", async (e) => {
      e.stopPropagation();
      e.preventDefault();
      const pageNo = parseInt(btn.dataset.pdfNotePage, 10);
      await createNoteFromPdfPage(view, pageNo, btn);
    });
  });
}
// Build the note for a single PDF page.
async function createNoteFromPdfPage(view, pageNo, btn) {
  const app = view.app, plugin = view.plugin, file = view.file;
  if (!file) return;
  try {
    // Any text the page does have (the figure sits above it in the same page div).
    let pageText = "";
    const holder = btn && btn.closest ? btn.closest("[data-pdf-page-no]") : null;
    if (holder) {
      pageText = [...holder.querySelectorAll("p")]
        .map((p) => (p.textContent || "").trim())
        .filter(Boolean)
        .join("\n\n")
        .slice(0, 4000);
    }
    const linkName = bookNoteLinkFor(plugin, file) || file.basename;
    const title = sanitizeNoteTitle(__ertr("{0} — стр. {1}", file.basename, pageNo));
    // Same folder rules as a note made from a highlight, so scan pages don't
    // land somewhere else than the rest of a book's notes.
    let folderOverride = null;
    if (plugin.settings.notesNextToBook && file.parent) {
      const beside = erPath(file.parent.path || "");
      if (beside) folderOverride = beside;
    }
    let filename = title, n = 2;
    while (app.vault.getAbstractFileByPath(inboxNotePath(app, filename, folderOverride))) filename = `${title} ${n++}`;
    const quote = pageText
      ? pageText.split("\n\n").map((p) => `> ${p}`).join("\n>\n")
      : __ertr("> *(страница-скан — текста для цитаты нет, впишите своими словами)*");
    // A scanned page has no paragraph to anchor to, so the backlink points at
    // the page — still one click from the note back to where it came from.
    const back = plugin.settings.quoteBacklinks !== false
      ? ` [${backlinkLabel(plugin)}](obsidian://qiaomu-book-reader?book=${encodeURIComponent(file.path)}&page=${pageNo})`
      : "";
    const body = `${quote}\n\n${__ertr("— из [[{0}]], стр. {1}", linkName, pageNo)}${back}\n`;
    await resolveNotesFolder(app, folderOverride);
    const path5 = inboxNotePath(app, filename, folderOverride);
    const note = await app.vault.create(path5, body);
    if (note instanceof TFile) {
      await appendLinkToBookNote(app, plugin, file, note);
      new Notice(__ertr("Заметка создана: {0}", note.basename));
      await openNoteBesideBook(app, plugin, note);
    }
  } catch (e) {
    console.error("Elton Reader: note from PDF page failed", e);
    new Notice(__ertr("Не удалось создать заметку"));
  }
}
// Follow a footnote reference, and leave a way back.
//
// A note you can reach but not return from is worse than no link at all: the
// reader ends up in the endnotes with no idea which page they left. So the
// origin spread is remembered and offered as a pill until it is used.
function followFootnote(view, ref) {
  const flow = view.pager && view.pager.flow;
  if (!flow || !ref) return false;
  const target = flow.querySelector(`[data-er-id="${CSS.escape(ref)}"]`);
  if (!target) return false;
  const from = view.pager.currentSpread;
  const fRect = flow.getBoundingClientRect();
  const x = target.getBoundingClientRect().left - fRect.left;
  const spread = Math.max(0, Math.min(
    Math.floor(Math.round(x / (view.pager.sw / (view.pager.cols || 1))) / (view.pager.cols || 1)),
    view.pager.total - 1));
  const [cur, tot] = view.pager.jumpTo(spread);
  (view.updateUI || view._updateUI).call(view, cur, tot);
  showFootnoteReturn(view, from);
  return true;
}
function showFootnoteReturn(view, spread) {
  hideFootnoteReturn(view);
  const host = view.areaEl;
  if (!host) return;
  const pill = host.createDiv("er-note-back");
  iconLabel(pill, "arrow-left", __ertr("Вернуться к тексту"));
  pill.setAttribute("role", "button");
  pill.setAttribute("tabindex", "0");
  const go = () => {
    const [cur, tot] = view.pager.jumpTo(spread);
    (view.updateUI || view._updateUI).call(view, cur, tot);
    hideFootnoteReturn(view);
  };
  pill.addEventListener("click", go);
  pill.addEventListener("keydown", (e) => {
    if (e.key === "Enter" || e.key === " ") { e.preventDefault(); go(); }
  });
  view._noteBackEl = pill;
}
function hideFootnoteReturn(view) {
  if (view._noteBackEl) { view._noteBackEl.remove(); view._noteBackEl = null; }
}
// The two views spell the same two methods differently (buildHlPanel /
// togglePanel in the leaf, _buildHlPanel / _togglePanel in the phone modal).
// Shared popup code must not have to know which one it is holding: calling the
// name the other view uses threw, and a comment written on the phone was saved
// and then vanished without a word.
// Куда ставить панель у выделения.
//
// getBoundingClientRect() у выделения врёт в двух местах, и обоих людей это
// поймало. Первое — начало абзаца: браузер добавляет к выделению пустой
// прямоугольник в конце предыдущей строки, и рамка выделения оказывается шире
// самого текста. Второе — граница страницы: текст разложен по колонкам, и
// выделение, задевшее соседнюю колонку, даёт рамку во всю ширину разворота —
// панель уезжает на пустое место или за экран. Поэтому берутся отдельные
// прямоугольники строк, пустые выбрасываются, оставшиеся ограничиваются
// видимой страницей — и рамка собирается уже из них.
function erSelectionRect(range, areaEl) {
  let rects = [];
  try {
    rects = [...range.getClientRects()].filter((r) => r.width > 0.5 && r.height > 0.5);
  } catch { /* optional step; a failure here must not interrupt reading */ }
  if (!rects.length) return range.getBoundingClientRect();
  const box = areaEl ? areaEl.getBoundingClientRect() : null;
  if (box) {
    const seen = rects.filter((r) => r.right > box.left + 1 && r.left < box.right - 1);
    if (seen.length) rects = seen;
  }
  const left = Math.min(...rects.map((r) => r.left));
  const right = Math.max(...rects.map((r) => r.right));
  const top = Math.min(...rects.map((r) => r.top));
  const bottom = Math.max(...rects.map((r) => r.bottom));
  return { left, right, top, bottom, width: right - left, height: bottom - top, x: left, y: top };
}
function erRefreshHlPanel(view) {
  const fn = view.buildHlPanel || view._buildHlPanel;
  if (typeof fn === "function") fn.call(view);
}
function closeInlineHighlightComment(view) {
  const pop = view && view.hlPopup;
  if (!pop) return;
  view._commentEditing = false;
  pop.removeClass("er-hl-popup-commenting");
  const editor = pop.querySelector(".er-hl-comment-editor");
  if (editor) editor.remove();
  if (view._hlPopupRect) positionHlPopup(view, view._hlPopupRect, 260, 44);
}
function openInlineHighlightComment(view) {
  const pop = view.hlPopup;
  const cur = view._currentHl();
  const pending = view._pendingSel;
  const editId = view._editHlId;
  if (!pop || !cur || !view.file) return;
  closeInlineHighlightComment(view);
  view._commentEditing = true;
  const existing = editId
    ? view.plugin.getHighlights(view.file.path).find((h) => h.id === editId)
    : null;
  pop.addClass("er-hl-popup-commenting");
  const editor = pop.createDiv("er-hl-comment-editor");
  const ta = editor.createEl("textarea", { cls: "er-hl-comment-textarea" });
  ta.value = existing && existing.comment ? existing.comment : "";
  ta.placeholder = __ertr("Напишите короткую мысль об этом фрагменте…");
  ta.setAttribute("aria-label", __ertr("Комментарий к выделению"));
  const actions = editor.createDiv("er-hl-comment-actions");
  const cancel = actions.createEl("button", { text: __ertr("Отмена") });
  cancel.addClass("er-hl-comment-cancel");
  const save = actions.createEl("button", { text: __ertr("Сохранить комментарий") });
  save.addClass("er-hl-comment-save");
  const reposition = () => {
    if (view._hlPopupRect) positionHlPopup(view, view._hlPopupRect, 310, 142);
  };
  window.requestAnimationFrame(reposition);
  cancel.addEventListener("click", () => closeInlineHighlightComment(view));
  const submit = async () => {
    let id = editId;
    if (!id && pending) {
      const parts = pending.parts || [pending];
      for (const part of parts) {
        const made = view._createHighlight(part, view.plugin.settings.defaultHlColor || "yellow");
        if (!id && made) id = made;
      }
    }
    if (!id) {
      new Notice(__ertr("Не удалось сохранить комментарий"));
      return;
    }
    await view.plugin.setHighlightComment(view.file.path, id, cur, ta.value.trim());
    view._renderFlowHighlights();
    erRefreshHlPanel(view);
    selOf(view.areaEl)?.removeAllRanges();
    view._hideHlPopup();
  };
  save.addEventListener("click", submit);
  ta.addEventListener("keydown", (e) => {
    if (e.key === "Enter" && (e.metaKey || e.ctrlKey)) {
      e.preventDefault();
      submit();
    }
    if (e.key === "Escape") {
      e.preventDefault();
      closeInlineHighlightComment(view);
    }
  });
  erAutoFocus(ta, 30);
}
// Keep the first-level selection UI task-sized: three familiar colours, then
// copy, comment and make-a-note. The comment control expands the same popover
// into a small nearby textarea, so the reader never loses the passage they are
// thinking about or gets moved to a separate dialog.
function addBarButtons(view, pop) {
  const row = pop.createDiv("er-hl-actions");
  for (const c of HL_COLORS.filter((item) => ["yellow", "green", "pink"].includes(item.id))) {
    const sw = row.createEl("button", { cls: "er-hl-sw er-hl-color" });
    sw.type = "button";
    sw.style.background = c.css;
    sw.setAttribute("aria-label", c.label());
    sw.addEventListener("click", () => view._applyPopupColor(c.id));
  }
  const act = (cls, icon2, label, fn) => {
    const b = row.createEl("button", { cls: "er-hl-sw " + cls });
    b.type = "button";
    svgIcon(b, icon2);
    b.setAttribute("aria-label", label);
    b.addEventListener("click", fn);
    return b;
  };
  act("er-hl-copy", "copy", __ertr("Копировать текст"), async () => {
    const cur = view._currentHl();
    view._hideHlPopup();
    selOf(view.areaEl)?.removeAllRanges();
    if (!cur) return;
    const ok = await copyToClipboard(cur.text);
    new Notice(ok ? __ertr("Скопировано ✓") : __ertr("Не удалось скопировать"));
  });
  act("er-hl-comment-btn", "message", __ertr("Комментарий к выделению"), () => {
    openInlineHighlightComment(view);
  });
  act("er-hl-note", "note", __ertr("Создать заметку"), () => {
    const cur = view._currentHl();
    view._hideHlPopup();
    selOf(view.areaEl)?.removeAllRanges();
    if (!cur) return;
    createNoteFromSelection(view.app, view.plugin, cur.text, view.file, { extra: hlCommentMd(cur), color: cur.color, hl: cur });
  });
}
// The breakdown itself: the passage on top, the answer under it, and the two
// things a reader wants to do with it — copy it, or keep it under the quote.
const AiExplainModal = class extends Modal {
  constructor(app, plugin, text, bookFile) {
    super(app);
    this.plugin = plugin;
    this.text = text;
    this.bookFile = bookFile;
    this.book = bookFile ? bookNoteLinkFor(plugin, bookFile) || bookFile.basename : "";
    // What has been said so far, in the shape the service wants it. Nothing is
    // sent until the reader says something: the passage alone is not a question.
    this.turns = [];
  }
  async onOpen() {
    const c = this.contentEl;
    c.empty();
    this.modalEl.addClass("er-ai-modal");
    // A chat is a column: a head that stays, a log that grows and scrolls, and
    // a composer pinned under it. On a phone the three used to be four stacked
    // rows of buttons with the conversation squeezed into the gap between them.
    const head = c.createDiv("er-ai-head");
    head.createDiv({ cls: "er-ai-title", text: __ertr("Разговор о фрагменте") });
    if (this.book) head.createDiv({ cls: "er-ai-book", text: this.book });
    // The passage is context, not the subject: two lines, and it opens on a tap
    // for the times the reader wants to check the wording.
    const quote = c.createDiv({ cls: "er-ai-quote", text: this.text });
    quote.addEventListener("click", () => quote.classList.toggle("er-ai-quote-open"));
    this.log = c.createDiv("er-ai-log");
    this._buildEmpty();
    const bar = c.createDiv("er-ai-bar");
    const input = bar.createEl("input", { cls: "er-ai-input", type: "text" });
    input.placeholder = __ertr("Сообщение…");
    const send = bar.createEl("button", { cls: "er-ai-send" });
    svgIcon(send, "send");
    send.setAttribute("aria-label", __ertr("Отправить"));
    const fire = async () => {
      const q = input.value.trim();
      if (!q) return;
      // Клавиатура уходит сразу: пока ждёшь ответ, она закрывает всё окно, а на
      // телефоне убрать её можно только сняв фокус — другого способа в вебвью нет.
      input.blur();
      // Поле пустеет в тот же момент, когда сообщение встало в ленту — как в
      // любом мессенджере. Раньше текст висел там до конца ответа и выглядел
      // так, будто ничего не отправилось. Если отправить не удалось, текст
      // возвращается на место, чтобы не набирать заново.
      input.value = "";
      if (!await this._send(q)) input.value = q;
    };
    send.addEventListener("click", fire);
    input.addEventListener("keydown", (e) => {
      if (e.key === "Enter") { e.preventDefault(); fire(); }
    });
    erAutoFocus(input);
    erBlurOnTapOutside(c, input);
    this._watchKeyboard();
  }
  // Obsidian на телефоне собран на Capacitor, и у окна есть честные события
  // клавиатуры с её высотой — единственный надёжный сигнал: visualViewport на
  // iOS под клавиатуру не сжимается вообще, а свой контейнер Obsidian ужимает
  // поздно и без события. Пока клавиатура открыта, окно прижимается к верху и
  // укорачивается ровно на её высоту, иначе строка ввода оказывается под ней и
  // не видно, что печатаешь.
  _watchKeyboard() {
    const modal = this.modalEl;
    const height = (e) => {
      const h = e && (e.keyboardHeight != null ? e.keyboardHeight
        : e.detail && e.detail.keyboardHeight);
      return typeof h === "number" && h > 0 ? h : 0;
    };
    this._kbShow = (e) => {
      const h = height(e);
      if (!h) return;
      modal.style.setProperty("--er-kb", h + "px");
      modal.addClass("er-kb-up");
      window.setTimeout(() => this._scroll(), 60);
    };
    this._kbHide = () => {
      modal.removeClass("er-kb-up");
      modal.style.removeProperty("--er-kb");
    };
    window.addEventListener("keyboardWillShow", this._kbShow);
    window.addEventListener("keyboardDidShow", this._kbShow);
    window.addEventListener("keyboardWillHide", this._kbHide);
  }
  // An empty chat should say what it is for and offer the one thing most
  // readers want first, instead of showing a bare input and a lone chip.
  _buildEmpty() {
    const empty = this.log.createDiv("er-ai-empty");
    svgIcon(empty.createDiv("er-ai-empty-icon"), "sparkles");
    empty.createDiv({ cls: "er-ai-empty-title", text: __ertr("О чём спросить?") });
    empty.createDiv({
      cls: "er-ai-empty-sub",
      text: __ertr("Спросите что угодно об этом фрагменте — или начните с разбора."),
    });
    const chip = empty.createEl("button", { cls: "er-ai-chip", text: __ertr("Разбери фрагмент") });
    chip.addEventListener("click", () => this._send(chip.textContent));
    this.empty = empty;
  }
  _scroll() { this.log.scrollTop = this.log.scrollHeight; }
  // Copy / keep, hung under the answer they belong to. A single pair of buttons
  // at the bottom of the window could only ever act on the last answer, and it
  // cost a whole row of a phone screen to say so.
  _actions(group, answer) {
    const row = group.createDiv("er-ai-acts");
    const act = (icon2, label, fn) => {
      const b = row.createEl("button", { cls: "er-ai-act" });
      svgIcon(b, icon2);
      b.createSpan({ text: label });
      b.addEventListener("click", fn);
      return b;
    };
    act("copy", __ertr("Копировать"), async () => {
      const ok = await copyToClipboard(answer);
      new Notice(ok ? __ertr("Скопировано ✓") : __ertr("Не удалось скопировать"));
    });
    act("note", __ertr("В заметку"), async () => {
      await createNoteFromSelection(this.app, this.plugin, this.text, this.bookFile, {
        extra: "\n\n" + answer,
        // The note is written mid-reading: it gets its own tab, but the book
        // stays in front — the reader goes to the note when they want to.
        openMode: "tab",
        openBackground: true,
      });
      this.close();
    });
  }
  // Sends one message and hangs the answer under it. Returns whether it went
  // through, so the input knows whether to clear itself.
  async _send(text) {
    if (this.busy || !text) return false;
    this.busy = true;
    if (this.empty) { this.empty.remove(); this.empty = null; }
    const me = this.log.createDiv("er-ai-msg er-ai-msg-me");
    me.setText(text);
    this.turns.push({ role: "user", content: text });
    const group = this.log.createDiv("er-ai-group");
    const bubble = group.createDiv("er-ai-msg er-ai-msg-ai");
    // Waiting looks like waiting: three dots that actually move, the same
    // indicator Elton AI uses. A still line of text reads as a frozen window.
    const ind = bubble.createDiv("er-ai-typing");
    const dots = ind.createDiv("er-ai-typing-dots");
    for (let i = 0; i < 3; i++) dots.createDiv("er-ai-typing-dot");
    ind.createDiv({ cls: "er-ai-typing-text", text: __ertr("Думаю…") });
    this._scroll();
    let answer = "";
    try {
      answer = await aiExplain(this.text, this.plugin.settings, this.turns, this.book);
    } catch (e) {
      console.error("Book Reader: AI chat failed", e);
      // The unanswered message leaves the thread: keeping it would send the same
      // question twice as soon as the next one is asked.
      this.turns.pop();
      const why = e && e.erReason;
      bubble.addClass("er-ai-msg-err");
      bubble.setText(
        why === "nokey" ? __ertr("Не задан ключ. Откройте настройки плагина → «Разбор ИИ» и вставьте ключ выбранного сервиса.")
          : why === "auth" ? __ertr("Сервис не принял ключ. Проверьте его в настройках плагина.")
            : why === "limit" ? __ertr("Сервис ограничил частые запросы. Подождите минуту и попробуйте снова.")
              : why === "local" ? __ertr("Локальная модель не отвечает. Проверьте, запущен ли Ollama или LM Studio.")
                : why === "empty" ? __ertr("Пустой ответ от модели.")
                  : why === "http" ? __ertr("Сервис ответил ошибкой {0}.", e.erStatus)
                    : __ertr("Не удалось связаться с сервисом. Похоже, нет интернета."));
      this._scroll();
      this.busy = false;
      return false;
    }
    this.turns.push({ role: "assistant", content: answer });
    this.answer = answer;
    bubble.empty();
    // Rendered as Markdown so the sections and lists read as sections and lists.
    await MarkdownRenderer.render(this.app, answer, bubble, this.bookFile ? this.bookFile.path : "", this);
    this._actions(group, answer);
    this._scroll();
    this.busy = false;
    return true;
  }
  onClose() {
    if (this._kbShow) {
      window.removeEventListener("keyboardWillShow", this._kbShow);
      window.removeEventListener("keyboardDidShow", this._kbShow);
    }
    if (this._kbHide) window.removeEventListener("keyboardWillHide", this._kbHide);
    this.contentEl.empty();
  }
};
function decodeFb2(buf) {
  const bytes = new Uint8Array(buf);
  let head = "";
  for (let i = 0; i < Math.min(bytes.length, 256); i++) head += String.fromCharCode(bytes[i]);
  const m = head.match(/encoding\s*=\s*["']([\w-]+)["']/i);
  const enc = (m ? m[1] : "utf-8").toLowerCase();
  try {
    return new TextDecoder(enc).decode(bytes);
  } catch {
    return new TextDecoder("utf-8").decode(bytes);
  }
}
function fb2Href(el) {
  let href = "";
  try {
    href = el.getAttributeNS("http://www.w3.org/1999/xlink", "href") || "";
  } catch { /* optional step; a failure here must not interrupt reading */ }
  if (!href) {
    for (const a of Array.from(el.attributes || [])) {
      if (a.name === "href" || a.name.endsWith(":href")) {
        href = a.value;
        break;
      }
    }
  }
  return href.replace(/^#/, "");
}
function fb2ImgSrc(el, images) {
  const id = fb2Href(el);
  return id ? images[id] || "" : "";
}
function fb2Img(src) {
  return `<img src="${escHtml(src)}" style="max-width:100%;height:auto;display:block;margin:8px auto">`;
}
function fb2Inline(el) {
  let out = "";
  for (const node of Array.from(el.childNodes || [])) {
    if (node.nodeType === 3) {
      out += escHtml(node.textContent || "");
      continue;
    }
    if (node.nodeType !== 1) continue;
    const t = (node.tagName || "").toLowerCase();
    const inner = fb2Inline(node);
    if (t === "emphasis") out += `<i>${inner}</i>`;
    else if (t === "strong") out += `<b>${inner}</b>`;
    else if (t === "strikethrough") out += `<s>${inner}</s>`;
    else if (t === "sup") out += `<sup>${inner}</sup>`;
    else if (t === "sub") out += `<sub>${inner}</sub>`;
    else if (t === "code") out += `<code>${inner}</code>`;
    else if (t === "a") {
      const ref = fb2Href(node);
      out += ref ? `<a class="er-fb2-ref" data-er-ref="${escHtml(ref)}">${inner}</a>` : inner;
    } else out += inner;
  }
  return out;
}
function fb2IsCodeLine(el) {
  const all = (el.textContent || "").replace(/\s/g, "").length;
  if (!all) return false;
  let inCode = 0;
  for (const c of Array.from(el.children || [])) {
    if ((c.tagName || "").toLowerCase() === "code") inCode += (c.textContent || "").replace(/\s/g, "").length;
  }
  return inCode / all >= 0.9;
}
function fb2MergeCode(out) {
  const html = [];
  let block = null;
  const flush = () => {
    if (!block || !block.length) {
      block = null;
      return;
    }
    const body = block.join("\n");
    if (body.trim()) html.push(`<pre class="er-code"><code>${escHtml(body)}</code></pre>`);
    block = null;
  };
  for (const item of out) {
    if (item && typeof item === "object" && typeof item.codeLine === "string") {
      (block || (block = [])).push(item.codeLine);
      continue;
    }
    flush();
    if (typeof item === "string") html.push(item);
  }
  flush();
  return html;
}
function fb2Node(el, images, out) {
  const tag = (el.tagName || "").toLowerCase();
  if (tag === "title") {
    const t = (el.textContent || "").replace(/\s+/g, " ").trim();
    if (t) out.push(`<h2>${escHtml(t)}</h2>`);
    return;
  }
  if (tag === "subtitle") {
    const t = (el.textContent || "").replace(/\s+/g, " ").trim();
    if (t) out.push(`<h3>${escHtml(t)}</h3>`);
    return;
  }
  if (tag === "p" || tag === "v" || tag === "text-author") {
    if (tag === "p" && fb2IsCodeLine(el)) {
      out.push({ codeLine: (el.textContent || "").replace(/\s+$/, "") });
      return;
    }
    const raw = (el.textContent || "").replace(/\s+/g, " ").trim();
    const toc = tocLineHtml(raw);
    if (toc) {
      out.push(toc);
      return;
    }
    const inner = fb2Inline(el);
    if (inner.trim()) out.push(`<p>${inner}</p>`);
    return;
  }
  if (tag === "empty-line") return;
  if (tag === "image") {
    const src = fb2ImgSrc(el, images);
    if (src) out.push(fb2Img(src));
    return;
  }
  if (tag === "binary" || tag === "description") return;
  for (const child of Array.from(el.children || [])) fb2Node(child, images, out);
}
async function extractFb2(file, app) {
  const buf = await app.vault.readBinary(file);
  const bytes = new Uint8Array(buf);
  if (bytes[0] === 80 && bytes[1] === 75) {
    new Notice(__ertr("Этот FB2 упакован в ZIP. Распакуйте архив и положите в хранилище сам файл .fb2."), 8e3);
    throw new Error("FB2 is zipped");
  }
  const doc = new DOMParser().parseFromString(decodeFb2(buf), "application/xml");
  if (doc.getElementsByTagName("parsererror").length) throw new Error("FB2 parse error");
  const images = {};
  for (const b of Array.from(doc.getElementsByTagName("binary"))) {
    const id = b.getAttribute("id");
    const ct = b.getAttribute("content-type") || "image/jpeg";
    const data = (b.textContent || "").replace(/\s+/g, "");
    if (id && data) images[id] = `data:${ct};base64,${data}`;
  }
  const parts = [];
  const cp = doc.getElementsByTagName("coverpage")[0];
  const coverImg = cp && cp.getElementsByTagName("image")[0];
  if (coverImg) {
    const src = fb2ImgSrc(coverImg, images);
    if (src) parts.push(`<div class="er-section">${fb2Img(src)}</div>`);
  }
  for (const body of Array.from(doc.getElementsByTagName("body"))) {
    for (const child of Array.from(body.children || [])) {
      let out = [];
      fb2Node(child, images, out);
      const html = fb2MergeCode(out).join("\n");
      const secId = child.getAttribute && child.getAttribute("id");
      const idAttr = secId ? ` data-er-id="${escHtml(secId)}"` : "";
      if (html.trim()) parts.push(`<div class="er-section"${idAttr}>${html}</div>`);
    }
  }
  if (!parts.length) throw new Error("FB2 has no readable text");
  return parts.join("\n");
}
async function extractPdf(file, app, settings = {}, onProgress) {
  await setupWorker(app);
  const alsoFigOnText = settings.pdfShowFiguresOnTextPages === true;
  const buf = await app.vault.readBinary(file);
  const doc = await pdfjsLib.getDocument({
      data: buf,
      // Книга — чужой файл. У pdf.js есть известная дыра, где специально
      // собранный шрифт выполняет свой код через eval; отключение eval —
      // штатное лечение от неё (CVE-2024-4367). На вёрстку не влияет.
      isEvalSupported: false,
    }).promise;
  const total = doc.numPages;
  const parts = [];
  const figRects = {};
  for (let i = 1; i <= total; i++) {
    if (onProgress && (i === 1 || i % 4 === 0 || i === total)) onProgress(i, total);
    const page = await doc.getPage(i);
    const tc = await page.getTextContent();
    const textLen = tc.items.reduce((n, it) => n + (typeof it.str === "string" ? it.str.replace(/\s+/g, "").length : 0), 0);
    const view = page.view || [0, 0, 612, 792];
    const pw = Math.max(1, Math.round(Math.abs(view[2] - view[0])));
    const ph = Math.max(1, Math.round(Math.abs(view[3] - view[1])));
    const textHtml = textLen > 0 ? pdfItemsToHtml(tc.items, tc.styles) : "";
    let html = textHtml;
    const brokenText = textLen >= 40 && pdfTextLooksUnreadable(tc.items);
    if (textLen < 40 || brokenText) {
      const fig = await pdfFigureScore(page);
      if (brokenText || fig && (fig.imgFrac >= 0.02 || fig.vectorOps >= 20 || fig.shading > 0)) {
        html = `<figure class="er-pdf-figure"><img class="er-pdf-page-img er-pdf-lazy" data-pdf-page="${i}" width="${pw}" height="${ph}" alt="">${pdfNoteBtn(i)}</figure>` + (brokenText ? "" : textHtml);
      }
    } else if (alsoFigOnText) {
      const fig = await pdfFigureScore(page);
      const picked = fig ? pdfPickFigures(fig.rects, view) : [];
      if (picked.length) {
        figRects[i] = picked;
        const figsHtml = picked.map((r, k) => {
          const rw = Math.max(1, Math.round(r.x1 - r.x0));
          const rh = Math.max(1, Math.round(r.y1 - r.y0));
          return `<figure class="er-pdf-figure"><img class="er-pdf-page-img er-pdf-lazy" data-pdf-page="${i}" data-pdf-rect="${k}" width="${rw}" height="${rh}" alt=""></figure>`;
        }).join("");
        const inside = (it) => {
          const x = it.transform[4], y = it.transform[5];
          return picked.some((r) => x >= r.x0 - 1 && x <= r.x1 + 1 && y >= r.y0 - 1 && y <= r.y1 + 1);
        };
        const outside = tc.items.filter((it) => !inside(it));
        const keptEnough = outside.length >= tc.items.length * 0.25;
        const bodyHtml = outside.length < tc.items.length && keptEnough ? pdfItemsToHtml(outside, tc.styles) : textHtml;
        html = figsHtml + bodyHtml;
      } else if (fig && fig.imgFrac >= 0.02) {
        html = `<figure class="er-pdf-figure"><img class="er-pdf-page-img er-pdf-lazy" data-pdf-page="${i}" width="${pw}" height="${ph}" alt="">${pdfNoteBtn(i)}</figure>` + textHtml;
      }
    }
    if (html) parts.push(`<div class="er-pdf-page-break" data-pdf-page-no="${i}">${html}</div>`);
  }
  const outline = [];
  try {
    const walk2 = async (nodes, level) => {
      for (const n of nodes || []) {
        let page = null;
        try {
          const dest = typeof n.dest === "string" ? await doc.getDestination(n.dest) : n.dest;
          if (Array.isArray(dest) && dest[0]) page = await doc.getPageIndex(dest[0]) + 1;
        } catch { /* optional step; a failure here must not interrupt reading */ }
        const label = String(n.title || "").replace(/\s+/g, " ").trim();
        if (label && page) outline.push({ label, page, level });
        if (n.items && n.items.length) await walk2(n.items, level + 1);
      }
    };
    await walk2(await doc.getOutline(), 0);
  } catch (e) {
    console.warn("Book Reader: PDF outline unavailable", e);
  }
  const lazy = {
    _doc: doc,
    _rects: figRects,
    // Painting a page has to be given a deadline. pdf.js will happily spend
    // minutes on one pathological page — measured at over 90 seconds on a page
    // whose neighbours needed five — and while it does, the figure loader is
    // holding its "busy" flag, so every other picture in the book waits behind
    // that one page and the reader looks as though images simply stopped
    // appearing. Racing the deadline is not enough on its own: the abandoned
    // render must be CANCELLED, or it keeps burning the same CPU it was taken
    // off. The task's own rejection is swallowed here, since by then the caller
    // has already been told by the deadline.
    async _paint(task, ms) {
      task.promise.catch(() => {
      });
      let timer = null;
      try {
        await Promise.race([
          task.promise,
          new Promise((_, rej) => {
            timer = window.setTimeout(() => {
              try {
                task.cancel();
              } catch { /* optional step; a failure here must not interrupt reading */ }
              rej(new Error("er-render-budget"));
            }, ms);
          })
        ]);
      } finally {
        window.clearTimeout(timer);
      }
    },
    // rectIdx === null → the whole page (a scan: the page IS the content).
    // Otherwise crop to one picture: the canvas is sized to the FIGURE and the
    // context shifted, so only that region lands on it — the reader sees the
    // illustration itself rather than a screenshot of the page around it.
    async render(pageNum, rectIdx) {
      const page = await doc.getPage(pageNum);
      const base = page.getViewport({ scale: 1 });
      const r = rectIdx == null ? null : (this._rects[pageNum] || [])[rectIdx] || null;
      if (!r) {
        const full = Math.max(1, Math.min(2, 1600 / Math.max(base.width, base.height, 1)));
        for (const [scale2, budget] of [[full, 15e3], [full / 2, 8e3]]) {
          const vp2 = page.getViewport({ scale: scale2 });
          const cv2 = document.createElement("canvas");
          cv2.width = Math.ceil(vp2.width);
          cv2.height = Math.ceil(vp2.height);
          const ctx2 = cv2.getContext("2d");
          ctx2.fillStyle = "#ffffff";
          ctx2.fillRect(0, 0, cv2.width, cv2.height);
          try {
            await this._paint(page.render({ canvasContext: ctx2, viewport: vp2 }), budget);
            return cv2.toDataURL("image/jpeg", 0.78);
          } catch (e) {
            if (String(e && e.message) !== "er-render-budget") throw e;
          }
        }
        throw new Error("er-render-too-heavy");
      }
      const rw = Math.max(1, r.x1 - r.x0), rh = Math.max(1, r.y1 - r.y0);
      const scale = Math.max(1, Math.min(3, 1400 / Math.max(rw, rh)));
      const vp = page.getViewport({ scale });
      const [ax, ay] = vp.convertToViewportPoint(r.x0, r.y0);
      const [bx, by] = vp.convertToViewportPoint(r.x1, r.y1);
      const left = Math.min(ax, bx), top = Math.min(ay, by);
      const cw = Math.max(1, Math.round(Math.abs(bx - ax)));
      const ch = Math.max(1, Math.round(Math.abs(by - ay)));
      const cv = document.createElement("canvas");
      cv.width = cw;
      cv.height = ch;
      const ctx = cv.getContext("2d");
      ctx.fillStyle = "#ffffff";
      ctx.fillRect(0, 0, cw, ch);
      ctx.translate(-left, -top);
      try {
        await this._paint(page.render({ canvasContext: ctx, viewport: vp }), 15e3);
      } catch (e) {
        throw String(e && e.message) === "er-render-budget" ? new Error("er-render-too-heavy") : e;
      }
      return cv.toDataURL("image/jpeg", 0.85);
    },
    destroy() {
      try {
        doc.destroy();
      } catch { /* optional step; a failure here must not interrupt reading */ }
    }
  };
  return { html: parts.join("\n"), lazy, outline };
}
function searchBookBlocks(blocks, query, limit = 300) {
  const q = String(query || "").trim().toLowerCase();
  if (q.length < 2) return [];
  let out = [];
  for (let i = 0; i < blocks.length && out.length < limit; i++) {
    const text = blocks[i];
    const hay = text.toLowerCase();
    let from = 0;
    while (out.length < limit) {
      const at = hay.indexOf(q, from);
      if (at < 0) break;
      const s = Math.max(0, at - 45), e = Math.min(text.length, at + q.length + 55);
      let pre = text.slice(s, at), post = text.slice(at + q.length, e);
      if (s > 0) pre = pre.replace(/^\S*\s/, "");
      if (e < text.length) post = post.replace(/\s\S*$/, "");
      out.push({
        block: i,
        pre: (s > 0 ? "…" : "") + pre,
        hit: text.slice(at, at + q.length),
        post: post + (e < text.length ? "…" : "")
      });
      from = at + q.length;
    }
  }
  return out;
}
function markFoundIn(view, query) {
  clearFoundIn(view);
  const flow = view.pager && view.pager.flow;
  const q = String(query || "").trim().toLowerCase();
  if (!flow || q.length < 2) return;
  if (typeof CSS === "undefined" || !CSS.highlights || typeof Highlight === "undefined") return;
  view._foundQuery = q;
  const ranges = [];
  const CAP = 2e3;
  try {
    const walker = docOf(flow).createTreeWalker(flow, NodeFilter.SHOW_TEXT);
    let node;
    while ((node = walker.nextNode()) && ranges.length < CAP) {
      const text = node.nodeValue || "";
      const hay = text.toLowerCase();
      let from = 0;
      while (ranges.length < CAP) {
        const at = hay.indexOf(q, from);
        if (at < 0) break;
        const r = docOf(flow).createRange();
        r.setStart(node, at);
        r.setEnd(node, at + q.length);
        ranges.push(r);
        from = at + q.length;
      }
    }
    if (ranges.length) CSS.highlights.set("er-found", new Highlight(...ranges));
    window.clearTimeout(view._foundTimer);
    view._foundTimer = window.setTimeout(() => clearFoundIn(view), FOUND_PAINT_MS);
  } catch { /* optional step; a failure here must not interrupt reading */ }
}
function clearFoundIn(view) {
  window.clearTimeout(view._foundTimer);
  view._foundQuery = "";
  try {
    if (typeof CSS !== "undefined" && CSS.highlights) CSS.highlights.delete("er-found");
  } catch { /* optional step; a failure here must not interrupt reading */ }
}
function buildFindPanelFor(view, p, { close, jump }) {
  p.empty();
  p.createDiv("er-pan-title").setText(__ertr("Поиск по книге"));
  const box = p.createDiv("er-toc-find");
  const inp = box.createEl("input", { type: "text" });
  inp.addClass("er-toc-find-input");
  inp.placeholder = __ertr("Что найти в книге…");
  const info = p.createDiv("er-find-info");
  const off = p.createDiv("er-find-off");
  off.setText(__ertr("Снять подсветку"));
  const list = p.createDiv("er-toc-list");
  off.addEventListener("click", () => {
    inp.value = "";
    clearFoundIn(view);
    list.empty();
    info.setText("");
  });
  view._findInput = inp;
  const run = () => {
    const q = inp.value;
    list.empty();
    if (q.trim().length < 2) {
      info.setText(__ertr("Введите хотя бы два символа"));
      clearFoundIn(view);
      return;
    }
    if (!view._findCorpus) view._findCorpus = blockTexts(view.pager && view.pager.flow);
    const hits = searchBookBlocks(view._findCorpus, q);
    if (!hits.length) {
      info.setText(__ertr("Ничего не найдено"));
      clearFoundIn(view);
      return;
    }
    info.setText(__ertr("Найдено: {0}. Слово подсвечено в тексте.", hits.length));
    markFoundIn(view, q);
    for (const h of hits) {
      const el = list.createDiv("er-toc-item er-find-item");
      const line = el.createDiv("er-find-text");
      line.createSpan({ text: h.pre });
      line.createSpan({ cls: "er-find-hit", text: h.hit });
      line.createSpan({ text: h.post });
      const spread = view.pager && view.pager.spreadForBlock ? view.pager.spreadForBlock(h.block) : null;
      if (typeof spread === "number") el.createDiv("er-toc-where").setText(__ertr("разв. {0}", spread + 1));
      el.addEventListener("click", () => {
        close();
        jump(h.block);
        markFoundIn(view, q);
      });
    }
  };
  let timer = null;
  inp.addEventListener("input", () => {
    window.clearTimeout(timer);
    timer = window.setTimeout(run, 180);
  });
  inp.addEventListener("keydown", (e) => {
    if (e.key === "Enter") {
      e.preventDefault();
      window.clearTimeout(timer);
      run();
    }
  });
}
function buildTocPanelFor(view, p, { close, jump }) {
  p.empty();
  p.createDiv("er-pan-title").setText(__ertr("Содержание"));
  const items = view.tocItems || [];
  if (!items.length) {
    p.createDiv("er-toc-empty").setText(__ertr("В этой книге не нашлось ни оглавления, ни заголовков."));
    return null;
  }
  let filter = "";
  if (items.length > 12) {
    const box = p.createDiv("er-toc-find");
    const inp = box.createEl("input", { type: "text" });
    inp.addClass("er-toc-find-input");
    inp.placeholder = __ertr("Фильтр по названию…");
    inp.addEventListener("input", () => {
      filter = inp.value.trim().toLowerCase();
      render();
    });
  }
  const list = p.createDiv("er-toc-list");
  const render = () => {
    list.empty();
    const cur = view.pager ? view.pager.spread : 0;
    let shown = 0;
    for (const item of items) {
      if (filter && !item.label.toLowerCase().includes(filter)) continue;
      shown++;
      const el = list.createDiv("er-toc-item");
      const row = el.createDiv("er-toc-row");
      row.createSpan({ cls: "er-toc-label", text: item.label });
      const spread = view.pager && view.pager.spreadForBlock ? view.pager.spreadForBlock(item.block) : null;
      const bits = [];
      if (item.page) bits.push(__ertr("стр. {0}", item.page));
      if (typeof spread === "number") bits.push(__ertr("разв. {0}", spread + 1));
      if (bits.length) row.createSpan({ cls: "er-toc-where", text: bits.join(" \xB7 ") });
      if (item.level) el.style.paddingLeft = `${8 + item.level * 12}px`;
      if (typeof spread === "number" && spread === cur) el.addClass("active");
      el.addEventListener("click", () => {
        close();
        jump(item.block);
      });
    }
    if (!shown) list.createDiv("er-toc-empty").setText(__ertr("Ничего не найдено"));
  };
  render();
  return render;
}
function chapterForBlock(toc, block) {
  if (!toc || !toc.length || typeof block !== "number") return "";
  let best = "";
  for (const it of toc) {
    if (it.block <= block) best = it.label;
    else break;
  }
  return best;
}
function pageForBlock(flow, block) {
  try {
    const blocks = flow ? flow.querySelectorAll("p,h1,h2,h3,h4") : null;
    const el = blocks && blocks[block];
    const holder = el && el.closest ? el.closest("[data-pdf-page-no]") : null;
    const p = holder ? parseInt(holder.getAttribute("data-pdf-page-no"), 10) : NaN;
    return isNaN(p) ? null : p;
  } catch {
    return null;
  }
}
function enrichHighlights(view, list) {
  const flow = view && view.pager ? view.pager.flow : null;
  const toc = view && view.tocItems || [];
  return (list || []).map((hl) => {
    if (typeof hl.block !== "number") return hl;
    return {
      ...hl,
      chapter: hl.chapter || chapterForBlock(toc, hl.block),
      page: hl.page || pageForBlock(flow, hl.block)
    };
  });
}
function currentBookPage(view) {
  try {
    const flow = view && view.pager ? view.pager.flow : null;
    if (!flow) return null;
    const block = view.pager.currentBlockIndex();
    if (typeof block !== "number" || block < 0) return null;
    return pageForBlock(flow, block);
  } catch {
    return null;
  }
}
function sendQuoteToBookNote(view, hl) {
  if (!hl || !hl.text) return;
  const [full] = enrichHighlights(view, [hl]);
  exportHighlightsToBookNote(view.app, view.plugin, view.file, [full]);
}
function pdfTextLooksUnreadable(items) {
  const text = (items || []).map((it) => typeof it.str === "string" ? it.str : "").join(" ");
  const tokens = text.split(/\s+/).filter(Boolean);
  if (tokens.length < 30) return false;
  const singles = tokens.filter((t) => t.length === 1).length;
  return singles / tokens.length > 0.7;
}
function blockTexts(flow) {
  if (!flow) return [];
  return [...flow.querySelectorAll("p,h1,h2,h3,h4")].map((el) => (el.textContent || "").replace(/\s+/g, " ").trim());
}
function tocLooksLikeNoise(items, all) {
  if (!items || items.length < 30) return false;
  const pages = /* @__PURE__ */ new Set();
  for (const el of all) {
    const h = el.closest ? el.closest("[data-pdf-page-no]") : null;
    if (h) pages.add(h.getAttribute("data-pdf-page-no"));
  }
  const limit = pages.size ? Math.max(30, pages.size * 0.6) : Math.max(30, all.length / 12);
  return items.length > limit;
}
function buildTocItems(html, outline) {
  try {
    const doc = new DOMParser().parseFromString(`<body>${html}</body>`, "text/html");
    const all = [...doc.body.querySelectorAll("p,h1,h2,h3,h4")];
    const pageOfBlock = (i) => {
      const el = all[i];
      const holder = el && el.closest ? el.closest("[data-pdf-page-no]") : null;
      const p = holder ? parseInt(holder.getAttribute("data-pdf-page-no"), 10) : NaN;
      return isNaN(p) ? null : p;
    };
    const withPages = (items2) => items2.map((it) => ({ ...it, page: pageOfBlock(it.block) }));
    if (outline && outline.length) {
      const firstBlockOf = /* @__PURE__ */ new Map();
      all.forEach((el, i) => {
        const holder = el.closest ? el.closest("[data-pdf-page-no]") : null;
        const p = holder ? parseInt(holder.getAttribute("data-pdf-page-no"), 10) : NaN;
        if (!isNaN(p) && !firstBlockOf.has(p)) firstBlockOf.set(p, i);
      });
      const pages = [...firstBlockOf.keys()].sort((a, b) => a - b);
      const items2 = [];
      for (const o of outline) {
        let block = firstBlockOf.get(o.page);
        if (block === void 0) {
          const nxt = pages.find((p) => p >= o.page);
          if (nxt === void 0) continue;
          block = firstBlockOf.get(nxt);
        }
        items2.push({ label: String(o.label).slice(0, 60), block, level: o.level || 0 });
      }
      if (items2.length) return withPages(items2);
    }
    const items = [];
    all.forEach((el, i) => {
      if (/^H[1-3]$/.test(el.tagName)) {
        const label = (el.textContent || "").trim().slice(0, 60);
        if (label) items.push({ label, block: i, level: 0 });
      }
    });
    if (items.length && !tocLooksLikeNoise(items, all)) return withPages(items);
    const printed = tocFromPrintedContents(all);
    if (printed.length && !tocLooksLikeNoise(printed, all)) return withPages(printed);
    const bold = tocFromBoldParagraphs(all);
    return tocLooksLikeNoise(bold, all) ? [] : withPages(bold);
  } catch {
    return [];
  }
}
function tocNorm(s) {
  return String(s || "").toLowerCase().replace(/[«»"'`.,:;!?()[\]—–-]/g, " ").replace(/\s+/g, " ").trim();
}
function tocFromPrintedContents(all) {
  const lines = [];
  all.forEach((el, i) => {
    if (el.classList && el.classList.contains("er-toc-line")) {
      const t = el.querySelector ? el.querySelector(".er-toc-t") : null;
      const label = ((t ? t.textContent : el.textContent) || "").trim();
      if (label) lines.push({ label, at: i });
    }
  });
  if (!lines.length) return [];
  const lastContents = lines[lines.length - 1].at;
  const body = [];
  all.forEach((el, i) => {
    if (i <= lastContents) return;
    if (el.classList && el.classList.contains("er-toc-line")) return;
    const txt = tocNorm(el.textContent);
    if (txt) body.push({ i, txt });
  });
  const items = [];
  let from = 0;
  for (const ln of lines) {
    const want = tocNorm(ln.label);
    if (!want) continue;
    let hit = -1;
    for (let k = from; k < body.length; k++) {
      const txt = body[k].txt;
      if (txt === want || txt.startsWith(want + " ") || want.length >= 12 && txt.startsWith(want)) {
        hit = k;
        break;
      }
    }
    if (hit < 0) continue;
    items.push({ label: ln.label.slice(0, 60), block: body[hit].i, level: 0 });
    from = hit + 1;
  }
  return items.length >= 3 ? items : [];
}
function tocFromBoldParagraphs(all) {
  const items = [];
  all.forEach((el, i) => {
    if (el.tagName !== "P") return;
    if (el.classList && el.classList.contains("er-toc-line")) return;
    const text = (el.textContent || "").trim();
    if (!text || text.length > 80 || text.length < 3) return;
    if (/[.!?;:]$/.test(text)) return;
    const kids = [...el.children || []];
    const bold = kids.length === 1 && /^(B|STRONG)$/.test(kids[0].tagName) && (kids[0].textContent || "").trim() === text;
    if (!bold) return;
    if (!/\s/.test(text) && text.length < 12) return;
    if (/^[\dIVXLCМ.,\s—–-]+$/i.test(text)) return;
    items.push({ label: text.slice(0, 60), block: i, level: 0 });
  });
  const seen = /* @__PURE__ */ new Map();
  for (const it of items) seen.set(it.label, (seen.get(it.label) || 0) + 1);
  const unique = items.filter((it) => seen.get(it.label) <= 2);
  const pages = Math.max(1, all.length / 12);
  if (unique.length > pages) return [];
  return unique.length >= 3 ? unique : [];
}
async function renderVisibleFigures(view) {
  const lazy = view._pdfLazy;
  if (!lazy || !view.pager || !view.pager.flow) return;
  bindPdfNoteButtons(view);
  if (view._figBusy) {
    view._figPending = true;
    return;
  }
  view._figBusy = true;
  try {
    const flow = view.pager.flow;
    const sw = view.pager.sw || 1;
    const cur = view.pager.spread;
    const fRect = flow.getBoundingClientRect();
    const scrolling = view.pager.scrollMode;
    const distOf = (img) => {
      const r = img.getBoundingClientRect();
      const at = scrolling ? r.top - fRect.top : r.left - fRect.left;
      return Math.abs(Math.floor(at / sw + 0.01) - cur);
    };
    const imgs = [...flow.querySelectorAll("img.er-pdf-lazy")];
    for (const img of imgs) {
      const dist = distOf(img);
      const loaded = img.dataset.loaded === "1";
      const gaveUp = img.dataset.loaded === "skip";
      if (dist <= 2 && !loaded && !gaveUp) {
        const ri = img.dataset.pdfRect;
        try {
          img.src = await lazy.render(parseInt(img.dataset.pdfPage), ri == null ? null : parseInt(ri));
          img.dataset.loaded = "1";
        } catch (e) {
          if (String(e && e.message) === "er-render-too-heavy") {
            img.dataset.loaded = "skip";
            img.addClass("er-pdf-heavy");
            img.alt = __ertr("Эта страница слишком тяжёлая, чтобы нарисовать её");
          }
        }
      } else if (dist > 6 && loaded) {
        img.removeAttribute("src");
        img.dataset.loaded = "0";
      }
    }
  } finally {
    view._figBusy = false;
    if (view._figPending) {
      view._figPending = false;
      renderVisibleFigures(view);
    }
  }
}
async function pdfFigureScore(page) {
  let ops;
  try {
    ops = await page.getOperatorList();
  } catch {
    return null;
  }
  const fn = ops.fnArray, args = ops.argsArray;
  const view = page.view || [0, 0, 612, 792];
  const pageArea = (Math.abs(view[2] - view[0]) || 1) * (Math.abs(view[3] - view[1]) || 1);
  let m = [1, 0, 0, 1, 0, 0];
  const stack = [];
  let imgArea = 0, vectorOps = 0, shading = 0;
  const rects = [];
  const paths = [];
  for (let i = 0; i < fn.length; i++) {
    const f = fn[i];
    if (f === 10) stack.push(m);
    else if (f === 11) {
      if (stack.length) m = stack.pop();
    } else if (f === 12) {
      const t = args[i];
      m = [
        m[0] * t[0] + m[2] * t[1],
        m[1] * t[0] + m[3] * t[1],
        m[0] * t[2] + m[2] * t[3],
        m[1] * t[2] + m[3] * t[3],
        m[0] * t[4] + m[2] * t[5] + m[4],
        m[1] * t[4] + m[3] * t[5] + m[5]
      ];
    } else if (f >= 83 && f <= 90) {
      imgArea += Math.abs(m[0] * m[3] - m[1] * m[2]);
      const xs = [m[4], m[0] + m[4], m[2] + m[4], m[0] + m[2] + m[4]];
      const ys = [m[5], m[1] + m[5], m[3] + m[5], m[1] + m[3] + m[5]];
      rects.push({ x0: Math.min(...xs), y0: Math.min(...ys), x1: Math.max(...xs), y1: Math.max(...ys) });
    } else if (f === 91) {
      const mm = args[i][2];
      if (mm && mm.length === 4) {
        const cx = [mm[0], mm[1], mm[0], mm[1]], cy = [mm[2], mm[2], mm[3], mm[3]];
        const xs = [], ys = [];
        for (let k = 0; k < 4; k++) {
          xs.push(m[0] * cx[k] + m[2] * cy[k] + m[4]);
          ys.push(m[1] * cx[k] + m[3] * cy[k] + m[5]);
        }
        paths.push({ x0: Math.min(...xs), y0: Math.min(...ys), x1: Math.max(...xs), y1: Math.max(...ys) });
      }
    } else if (f >= 20 && f <= 27) vectorOps++;
    else if (f === 62) shading++;
  }
  const drawn = paths.length > 1 ? mergeRects(paths, 4) : [];
  return { imgFrac: imgArea / pageArea, vectorOps, shading, rects: rects.concat(drawn) };
}
function pdfNoteBtn(pageNo) {
  return `<button class="er-pdf-note-btn" data-pdf-note-page="${pageNo}" type="button" title="${escHtml(__ertr("Заметка с этой страницы"))}">${icon("note")}</button>`;
}
function rectsNear(a, b, pad) {
  return !(a.x1 + pad < b.x0 || b.x1 + pad < a.x0 || a.y1 + pad < b.y0 || b.y1 + pad < a.y0);
}
function mergeRects(rects, pad) {
  let out = [];
  for (const r of rects) {
    let cur = { ...r };
    let merged = true;
    while (merged) {
      merged = false;
      for (let i = out.length - 1; i >= 0; i--) {
        if (rectsNear(cur, out[i], pad)) {
          const o = out.splice(i, 1)[0];
          cur = {
            x0: Math.min(cur.x0, o.x0),
            y0: Math.min(cur.y0, o.y0),
            x1: Math.max(cur.x1, o.x1),
            y1: Math.max(cur.y1, o.y1)
          };
          merged = true;
        }
      }
    }
    out.push(cur);
  }
  return out;
}
function pdfPickFigures(rects, view) {
  const pw = Math.abs(view[2] - view[0]) || 612;
  const ph = Math.abs(view[3] - view[1]) || 792;
  const pageArea = pw * ph;
  const big = (rects || []).filter((r) => {
    const w = r.x1 - r.x0, h = r.y1 - r.y0;
    if (w < 48 || h < 48) return false;
    if (w * h < pageArea * 0.015) return false;
    if (w * h > pageArea * 0.92) return false;
    return true;
  });
  return mergeRects(big, 6).filter((r) => r.x1 - r.x0 >= 56 && r.y1 - r.y0 >= 56).sort((a, b) => b.y1 - a.y1);
}
const BLOCK_TAGS = /^(p|div|section|article|main|aside|figure|figcaption|h[1-6]|ul|ol|dl|li|dt|dd|table|pre|blockquote|hr|img)$/i;
function tableToHtml(el) {
  let _a, _b;
  const rows = Array.from((_b = (_a = el.querySelectorAll) == null ? void 0 : _a.call(el, "tr")) != null ? _b : []);
  if (!rows.length) return "";
  const body = rows.map((tr) => {
    const cells = Array.from(tr.children || []).filter((c) => /^(td|th)$/i.test(c.tagName || ""));
    if (!cells.length) return "";
    return "<tr>" + cells.map((c) => {
      const t = (c.tagName || "").toLowerCase() === "th" ? "th" : "td";
      const inner = inlineHtml(c).trim();
      return `<${t}>${inner}</${t}>`;
    }).join("") + "</tr>";
  }).filter(Boolean).join("");
  return body ? `<table class="er-table">${body}</table>` : "";
}
function nodeToHtml(el) {
  let _a2, _b2, _c2;
  let _a, _b, _c, _d;
  if (!el)
    return "";
  const tag = (_b = (_a = el.tagName) == null ? void 0 : _a.toLowerCase()) != null ? _b : "";
  const text = (_d = (_c = el.textContent) == null ? void 0 : _c.trim()) != null ? _d : "";
  if (!text && !["br", "hr", "img"].includes(tag) && !((_a2 = el.querySelector) == null ? void 0 : _a2.call(el, "img")))
    return "";
  if (/^h[1-6]$/.test(tag))
    return `<${tag}>${escHtml(text)}</${tag}>`;
  if (tag === "br")
    return "<br>";
  if (tag === "hr")
    return "<hr>";
  if (tag === "img") {
    const src = (_c2 = (_b2 = el.getAttribute) == null ? void 0 : _b2.call(el, "src")) != null ? _c2 : "";
    if (!src) return "";
    return `<img src="${escHtml(src)}" style="max-width:100%;height:auto;display:block;margin:8px auto">`;
  }
  if (tag === "pre") {
    const code = (el.textContent || "").replace(/\s+$/, "");
    return code.trim() ? `<pre class="er-code"><code>${escHtml(code)}</code></pre>` : "";
  }
  if (tag === "table") return tableToHtml(el);
  if (tag === "aside") {
    const inner = Array.from(el.children).map((c) => nodeToHtml(c)).filter(Boolean).join("\n") || (inlineHtml(el).trim() ? `<p>${inlineHtml(el)}</p>` : "");
    return inner ? `<div class="er-side-notes">${inner}</div>` : "";
  }
  if (["div", "section", "article", "body", "main", "aside", "figure"].includes(tag)) {
    const hasBlockChild = Array.from(el.children).some((c) => BLOCK_TAGS.test(c.tagName || ""));
    if (!hasBlockChild) {
      const inner = inlineHtml(el);
      return inner.trim() ? `<p>${inner}</p>` : "";
    }
    const childHtml = Array.from(el.children).map((c) => nodeToHtml(c)).filter(Boolean).join("\n");
    if (!childHtml) {
      const direct = directText(el).trim();
      return direct ? `<p>${escHtml(direct)}</p>` : "";
    }
    return childHtml;
  }
  if (["p", "li", "dt", "dd", "blockquote"].includes(tag)) {
    const toc = tocLineHtml(text);
    if (toc) return toc;
    const inner = inlineHtml(el);
    return inner.trim() ? `<p>${inner}</p>` : "";
  }
  if (["ul", "ol", "dl"].includes(tag)) {
    return Array.from(el.children).map((c) => nodeToHtml(c)).filter(Boolean).join("\n");
  }
  return text ? `<p>${escHtml(text)}</p>` : "";
}
function inlineHtml(el) {
  let _a2;
  let _a, _b, _c;
  let out = "";
  for (const node of Array.from(el.childNodes)) {
    if (node.nodeType === Node.TEXT_NODE) {
      out += escHtml((_a = node.textContent) != null ? _a : "");
    } else if (node.nodeType === Node.ELEMENT_NODE) {
      const t = (_c = (_b = node.tagName) == null ? void 0 : _b.toLowerCase()) != null ? _c : "";
      const inner = inlineHtml(node);
      if (["b", "strong"].includes(t))
        out += `<strong>${inner}</strong>`;
      else if (["i", "em"].includes(t))
        out += `<em>${inner}</em>`;
      else if (["code", "kbd", "samp", "tt", "var"].includes(t))
        out += `<code>${inner}</code>`;
      else if (t === "sup")
        out += `<sup>${inner}</sup>`;
      else if (t === "sub")
        out += `<sub>${inner}</sub>`;
      else if (t === "br")
        out += "<br>";
      else if (t === "img") {
        const src = ((_a2 = node.getAttribute) == null ? void 0 : _a2.call(node, "src")) || "";
        if (src) out += `<img src="${escHtml(src)}" style="max-width:100%;height:auto">`;
      } else
        out += inner;
    }
  }
  return out;
}
function directText(el) {
  return Array.from(el.childNodes).filter((n) => n.nodeType === Node.TEXT_NODE).map((n) => {
    let _a;
    return (_a = n.textContent) != null ? _a : "";
  }).join("");
}
function fixPunct(s) {
  return (s || "").replace(/­/g, "").replace(/[ \t\u00A0]+/g, " ").replace(/\s+([,.;:!?…)\]»%”’])/g, "$1").replace(/([([«“‘])\s+/g, "$1").replace(/([А-Яа-яЁёA-Za-z]) - ([А-Яа-яЁёA-Za-z])/g, "$1—$2").replace(/ +/g, " ").trim();
}
function dehyphenate(prev, next) {
  if (/[а-яёa-z]-$/i.test(prev) && /^[а-яё]/.test(next)) return prev.slice(0, -1) + next;
  return prev + (prev ? " " : "") + next;
}
function isListStart(s) {
  const t = (s || "").replace(/^[\s"«(]+/, "");
  if (/^[✓✔•·◦‣▪▫●○■□◆◉➤●❖*]/.test(t)) return true;
  if (/^\d{1,3}[.)]\s/.test(t)) return true;
  if (/^[а-яёa-z][.)]\s/.test(t)) return true;
  return false;
}
function isMonoRun(it, styles, measured) {
  const st = styles && it.fontName ? styles[it.fontName] : null;
  if (st && /mono/i.test(String(st.fontFamily || ""))) return true;
  if (measured && it.fontName && measured.has(it.fontName)) return true;
  return /courier|consol|menlo|monaco|mono/i.test(String(it.fontName || ""));
}
function pdfMeasureMonoFonts(items) {
  let _a, _b;
  const byFont = /* @__PURE__ */ new Map();
  for (const it of items) {
    if (!it || typeof it.str !== "string" || !it.fontName) continue;
    if (it.str.replace(/\s/g, "").length < 4 || !(it.width > 0)) continue;
    const size = Math.abs((_b = (_a = it.transform) == null ? void 0 : _a[3]) != null ? _b : 0) || 12;
    const adv = it.width / it.str.length / size;
    if (!(adv > 0)) continue;
    (byFont.get(it.fontName) || byFont.set(it.fontName, []).get(it.fontName)).push(adv);
  }
  const mono = /* @__PURE__ */ new Set();
  for (const [name, adv] of byFont) {
    if (adv.length < 4) continue;
    const mean = adv.reduce((a, b) => a + b, 0) / adv.length;
    if (!(mean > 0)) continue;
    const sd = Math.sqrt(adv.reduce((a, b) => a + (b - mean) ** 2, 0) / adv.length);
    if (sd / mean < 0.02) mono.add(name);
  }
  return mono;
}
function tocLineHtml(text) {
  const t = splitTocLine(text);
  if (!t) return null;
  return `<p class="er-toc-line"><span class="er-toc-t">${escHtml(t.title)}</span><span class="er-toc-n">${escHtml(t.page)}</span></p>`;
}
function splitTocLine(s) {
  const m = String(s || "").trim().match(/^(.*?)[\s.]*\.{4,}[\s.]*(\d{1,4})\s*$/);
  if (!m) return null;
  const title = m[1].replace(/[\s.]+$/, "").trim();
  return title ? { title, page: m[2] } : null;
}
function pdfAsideBoundary(lines, pageLeft, pageRight) {
  const width = pageRight - pageLeft;
  if (!(width > 0)) return null;
  const minX = pageLeft + width * 0.45;
  const candidates = lines.filter((l) => l.x >= minX && l.monoInk === 0 && l.propInk > 0);
  if (candidates.length < 3) return null;
  const left = Math.min(...candidates.map((l) => l.x));
  if (left < minX) return null;
  return left - 6;
}
function looksLikeCodeLine(text) {
  const s = String(text || "").trim();
  if (!s) return false;
  if (!/[{}()[\];=]|>>>|^\s*(def |class |import |from |#include|@)/.test(s)) return false;
  const words = s.split(/\s+/).filter(Boolean).length;
  if (words >= 9 && /^[A-ZА-ЯЁ][a-zа-яё]{2,}\s/.test(s) && !/[;{}=]|>>>/.test(s)) return false;
  return true;
}
function pdfItemsToHtml(items, styles) {
  let _a, _b, _c, _d, _e, _f, _g;
  const runs = items.filter((it) => it && typeof it.str === "string");
  if (!runs.length) return "";
  const monoFonts = pdfMeasureMonoFonts(runs);
  const sorted = runs.slice().sort((a, b) => {
    let _a2, _b2, _c2, _d2, _e2, _f2, _g2, _h;
    const ay = (_b2 = (_a2 = a.transform) == null ? void 0 : _a2[5]) != null ? _b2 : 0, by = (_d2 = (_c2 = b.transform) == null ? void 0 : _c2[5]) != null ? _d2 : 0;
    if (Math.abs(ay - by) > 3) return by - ay;
    return ((_f2 = (_e2 = a.transform) == null ? void 0 : _e2[4]) != null ? _f2 : 0) - ((_h = (_g2 = b.transform) == null ? void 0 : _g2[4]) != null ? _h : 0);
  });
  const lines = [];
  for (const it of sorted) {
    const str = it.str;
    const y = (_b = (_a = it.transform) == null ? void 0 : _a[5]) != null ? _b : 0;
    const x = (_d = (_c = it.transform) == null ? void 0 : _c[4]) != null ? _d : 0;
    const size = Math.abs((_f = (_e = it.transform) == null ? void 0 : _e[3]) != null ? _f : 12) || 12;
    let w = (_g = it.width) != null ? _g : 0;
    if (!w && str) w = str.length * size * 0.5;
    const ink = str.replace(/\s/g, "").length;
    const mono = isMonoRun(it, styles, monoFonts);
    const piece = { str, x, w, size, mono, ink };
    const last = lines[lines.length - 1];
    if (last && Math.abs(y - last.y) <= Math.max(2, size * 0.35)) {
      last.pieces.push(piece);
      last.endX = Math.max(last.endX, x + w);
      last.size = Math.max(last.size, size);
      last.x = Math.min(last.x, x);
      if (mono) last.monoInk += ink;
      else last.propInk += ink;
    } else if (str.trim() !== "") {
      lines.push({ y, x, endX: x + w, size, monoInk: mono ? ink : 0, propInk: mono ? 0 : ink, pieces: [piece] });
    }
  }
  if (!lines.length) return "";
  const stitch = (pieces) => {
    let text = "";
    let endX = null;
    for (const p of pieces) {
      if (endX !== null && !/\s$/.test(text) && !/^\s/.test(p.str)) {
        const gapRight = p.x - endX > p.size * 0.2;
        const wrapped = p.x < endX - p.size;
        if (gapRight || wrapped) text += " ";
      }
      text += p.str;
      endX = p.x + p.w;
    }
    return text;
  };
  const pageLeft = Math.min(...lines.map((l) => l.x));
  const pageRight = Math.max(...lines.map((l) => l.endX));
  const asideAt = pdfAsideBoundary(lines, pageLeft, pageRight);
  const asides = [];
  if (asideAt !== null) {
    for (const l of lines) {
      const hasMono = l.pieces.some((p) => p.mono);
      const allProp = !hasMono;
      const wholeLineAside = allProp && l.x >= asideAt;
      if (!wholeLineAside && !hasMono) continue;
      const keep = [], moved = [];
      for (const p of l.pieces) ((wholeLineAside || p.x >= asideAt) && !p.mono ? moved : keep).push(p);
      if (!moved.length) continue;
      if (!keep.length) {
        l.dropped = true;
        asides.push({ y: l.y, text: stitch(moved) });
        continue;
      }
      l.pieces = keep;
      l.endX = Math.max(...keep.map((p) => p.x + p.w));
      l.monoInk = keep.filter((p) => p.mono).reduce((s, p) => s + p.ink, 0);
      l.propInk = keep.filter((p) => !p.mono).reduce((s, p) => s + p.ink, 0);
      asides.push({ y: l.y, text: stitch(moved) });
    }
  }
  for (const l of lines) l.text = stitch(l.pieces);
  const real = lines.filter((l) => !l.dropped && l.text.trim() !== "");
  if (!real.length && !asides.length) return "";
  const avg = real.length ? real.reduce((s, l) => s + l.size, 0) / real.length : 12;
  const measure = Math.max(...real.map((l) => l.endX - l.x)) || 1;
  const gaps = [];
  for (let i = 1; i < real.length; i++) {
    const g = Math.abs(real[i - 1].y - real[i].y);
    if (g > 0.5 && g < avg * 6) gaps.push(g);
  }
  gaps.sort((a, b) => a - b);
  const bucket = /* @__PURE__ */ new Map();
  for (const g of gaps) {
    const k = Math.round(g * 2) / 2;
    bucket.set(k, (bucket.get(k) || 0) + 1);
  }
  let mode = 0, modeN = 0;
  for (const [k, n] of bucket) if (n > modeN || n === modeN && k > mode) {
    mode = k;
    modeN = n;
  }
  const lineGap = gaps.length ? Math.min(modeN >= 3 ? mode : gaps[Math.floor(gaps.length * 0.3)], avg * 2.2) : avg * 1.4;
  const paraGap = Math.max(lineGap * 1.45, avg * 1.1);
  const leftXs = real.map((l) => l.x).sort((a, b) => a - b);
  const bodyLeft = leftXs.length ? leftXs[Math.floor(leftXs.length * 0.15)] : 0;
  const indentMin = Math.max(avg * 0.8, (pageRight - bodyLeft) * 0.015);
  const indentedLines = real.filter((l) => l.x - bodyLeft > indentMin).length;
  const indentMarksParas = indentedLines / (real.length || 1) <= 0.35;
  const monoInk = real.reduce((s, l) => s + l.monoInk, 0);
  const allInk = real.reduce((s, l) => s + l.monoInk + l.propInk, 0) || 1;
  const codeAllowed = monoInk / allInk < 0.8;
  const isSeed = (l) => {
    if (!codeAllowed || !(l.monoInk > 0) || l.monoInk < l.propInk) return false;
    const ratio = l.monoInk / (l.monoInk + l.propInk || 1);
    return ratio >= 0.8 || looksLikeCodeLine(l.text);
  };
  const codeFlag = new Array(real.length).fill(false);
  for (let i = 0; i < real.length; i++) if (isSeed(real[i])) codeFlag[i] = true;
  for (let i = 0; i < real.length; i++) {
    if (!codeFlag[i]) continue;
    let j = i, inner = [];
    while (j + 1 < real.length && codeFlag[j + 1]) {
      inner.push(real[j].y - real[j + 1].y);
      j++;
    }
    const tight = inner.length ? Math.min(...inner) * 1.3 : lineGap * 0.95;
    const blockLeft = Math.min(...real.slice(i, j + 1).map((l) => l.x));
    for (let k = j + 1; k < real.length; k++) {
      const gap = real[k - 1].y - real[k].y;
      if (!(gap > 0 && gap <= tight)) break;
      if (real[k].x < blockLeft - real[k].size) break;
      if (real[k].size > avg * 1.22) break;
      if (!looksLikeCodeLine(real[k].text)) break;
      if (real[k].endX - real[k].x > measure * 0.92) break;
      codeFlag[k] = true;
    }
    i = j;
  }
  const html = [];
  let para = "";
  let lastY = null;
  let code = null;
  const flush = () => {
    if (para.trim()) {
      const li = isListStart(para) ? ' class="er-pdf-li"' : "";
      html.push(`<p${li}>${escHtml(fixPunct(para))}</p>`);
      para = "";
    }
  };
  const flushCode = () => {
    if (!code || !code.lines.length) {
      code = null;
      return;
    }
    const minX = Math.min(...code.lines.map((l) => l.x));
    const unit = Math.max(1, code.size * 0.5);
    const body = code.lines.map((l) => " ".repeat(Math.min(60, Math.max(0, Math.round((l.x - minX) / unit)))) + l.text.replace(/\s+$/, "")).join("\n");
    if (body.trim()) html.push(`<pre class="er-code"><code>${escHtml(body)}</code></pre>`);
    code = null;
  };
  for (let i = 0; i < real.length; i++) {
    const line = real[i];
    if (codeFlag[i]) {
      flush();
      if (!code) code = { lines: [], size: line.size };
      code.lines.push(line);
      code.size = Math.max(code.size, line.size);
      lastY = line.y;
      continue;
    }
    const t2 = fixPunct(line.text);
    if (!t2) continue;
    flushCode();
    const toc = tocLineHtml(t2);
    if (toc) {
      flush();
      html.push(toc);
      lastY = line.y;
      continue;
    }
    const fillsMeasure = line.endX - line.x > measure * 0.9;
    const isH = line.size > avg * 1.22 && !fillsMeasure && t2.length < 120;
    const gap = lastY !== null ? Math.abs(lastY - line.y) : 0;
    if (isH) {
      flush();
      html.push(`<h3>${escHtml(t2)}</h3>`);
      lastY = line.y;
      continue;
    }
    if (lastY !== null && gap > paraGap) flush();
    else if (indentMarksParas && para && line.x - bodyLeft > indentMin) flush();
    if (para && isListStart(t2)) flush();
    para = para ? dehyphenate(para, t2) : t2;
    lastY = line.y;
  }
  flush();
  flushCode();
  if (asides.length) {
    const merged = [];
    for (const a of asides) {
      const prev = merged[merged.length - 1];
      if (prev && prev.y - a.y > 0 && prev.y - a.y <= avg * 1.8) {
        prev.text += " " + a.text;
        prev.y = a.y;
      } else merged.push({ y: a.y, text: a.text });
    }
    const body = merged.map((a) => fixPunct(a.text)).filter(Boolean);
    if (body.length) {
      html.push(`<div class="er-side-notes">${body.map((t) => `<p>${escHtml(t)}</p>`).join("")}</div>`);
    }
  }
  return html.join("\n");
}
function offsetInBlock(block, container, offset) {
  try {
    const r = docOf(block).createRange();
    r.setStart(block, 0);
    r.setEnd(container, offset);
    return r.toString().length;
  } catch {
    return 0;
  }
}
function nthIndexOf(text, sub, occ) {
  let idx = -1;
  for (let i = 0; i <= occ; i++) {
    idx = text.indexOf(sub, idx + 1);
    if (idx < 0) return -1;
  }
  return idx;
}
function countOccurrencesBefore(text, sub, limit) {
  if (!sub) return 0;
  let n = 0, idx = -1;
  while ((idx = text.indexOf(sub, idx + 1)) >= 0 && idx < limit) n++;
  return n;
}
function _hlNormMap(s) {
  s = s || "";
  let norm = "";
  const map = [];
  let prevSpace = false;
  for (let i = 0; i < s.length; i++) {
    let c = s[i];
    if (c === "\xA0" || c === " " || /\s/.test(c)) {
      if (prevSpace) continue;
      norm += " ";
      map.push(i);
      prevSpace = true;
      continue;
    }
    prevSpace = false;
    if (c === "‘" || c === "’" || c === "‚" || c === "‛") c = "'";
    else if (c === "“" || c === "”" || c === "„" || c === "‟") c = '"';
    else if (c === "–" || c === "—" || c === "−") c = "-";
    norm += c;
    map.push(i);
  }
  return { norm, map };
}
function locateHl(blockText, hl) {
  if (!hl || !hl.text) return null;
  const occ = typeof hl.occ === "number" ? hl.occ : 0;
  let start = nthIndexOf(blockText, hl.text, occ);
  if (start >= 0) return { start, len: hl.text.length };
  if (hl.pre != null || hl.post != null) {
    let from = 0, idx;
    while ((idx = blockText.indexOf(hl.text, from)) >= 0) {
      const preOk = !hl.pre || blockText.slice(Math.max(0, idx - hl.pre.length), idx).endsWith(hl.pre);
      const endPos = idx + hl.text.length;
      const postOk = !hl.post || blockText.slice(endPos, endPos + hl.post.length).startsWith(hl.post);
      if (preOk && postOk) return { start: idx, len: hl.text.length };
      from = idx + 1;
    }
  }
  const { norm: nBlock, map } = _hlNormMap(blockText);
  const nText = _hlNormMap(hl.text).norm.trim();
  if (nText) {
    let nIdx = -1;
    const nPre = hl.pre ? _hlNormMap(hl.pre).norm.trim() : "";
    if (nPre) {
      const p = nBlock.indexOf(nPre);
      if (p >= 0) nIdx = nBlock.indexOf(nText, Math.max(0, p + nPre.length - 1));
    }
    if (nIdx < 0) nIdx = nBlock.indexOf(nText);
    if (nIdx >= 0 && nIdx < map.length) {
      const lastN = Math.min(nIdx + nText.length - 1, map.length - 1);
      const startRaw = map[nIdx];
      const endRaw = map[lastN] + 1;
      if (endRaw > startRaw) return { start: startRaw, len: endRaw - startRaw };
    }
  }
  return null;
}
// Снять со страницы все нарисованные выделения.
//
// Нужно с тех пор, как перекладка страниц перестала выбрасывать DOM книги: узлы
// переживают смену шрифта, а значит прошлые обёртки остаются на месте, и
// рисовать поверх них второй раз нельзя — получится вложенность и мусор.
function unwrapAllHighlights(flow) {
  if (!flow) return;
  flow.querySelectorAll("[data-hl-id]").forEach((span) => {
    const parent = span.parentNode;
    if (!parent) return;
    while (span.firstChild) parent.insertBefore(span.firstChild, span);
    parent.removeChild(span);
    parent.normalize();
  });
}
function wrapBlockRange(block, start, end, hl) {
  if (end <= start) return;
  const walker = docOf(block).createTreeWalker(block, NodeFilter.SHOW_TEXT, null);
  let node, pos = 0;
  const targets = [];
  while ((node = walker.nextNode())) {
    const len = node.textContent.length;
    const nodeStart = pos, nodeEnd = pos + len;
    pos = nodeEnd;
    if (nodeEnd <= start || nodeStart >= end) continue;
    targets.push({ node, s: Math.max(0, start - nodeStart), e: Math.min(len, end - nodeStart) });
  }
  for (const t of targets) {
    let n = t.node;
    if (t.e < n.textContent.length) n.splitText(t.e);
    if (t.s > 0) n = n.splitText(t.s);
    const span = docOf(block).createElement("span");
    span.className = "er-hl";
    span.style.background = hl.color;
    span.setAttribute("data-hl-id", hl.id);
    n.parentNode.insertBefore(span, n);
    span.appendChild(n);
  }
}
function _readerSettings(app) {
  const plugins = app && app.plugins && app.plugins.plugins;
  const p = plugins ? (plugins["qiaomu-book-reader"] || plugins["elton-reader-books"]) : null;
  return p && p.settings || {};
}
function noteTemplatePath(app, bookFile) {
  const s = _readerSettings(app);
  if (bookFile && s.bookTemplates && s.bookTemplates[bookFile.path]) return erPath(s.bookTemplates[bookFile.path]);
  return erPath(s.noteTemplate);
}
function bookNoteTemplatePath(app) {
  return erPath(_readerSettings(app).bookNoteTemplate);
}
function notesFolderPath(app) {
  return erPath(_readerSettings(app).notesFolder);
}
function bookNotesFolderPath(app) {
  return erPath(_readerSettings(app).bookNotesFolder);
}
function inboxNotePath(app, name, override) {
  const f = typeof override === "string" && override !== "" ? erPath(override) : notesFolderPath(app);
  return erPath(f ? `${f}/${name}.md` : `${name}.md`);
}
async function resolveNotesFolder(app, override) {
  const f = typeof override === "string" && override !== "" ? erPath(override) : notesFolderPath(app);
  if (!f) return app.vault.getRoot();
  let folder = app.vault.getAbstractFileByPath(f);
  if (!folder) {
    await app.vault.createFolder(f).catch(() => {
    });
    folder = app.vault.getAbstractFileByPath(f);
  }
  return folder || app.vault.getRoot();
}
function bookNoteFiles(app) {
  const base = bookNotesFolderPath(app);
  const all = app.vault.getMarkdownFiles();
  if (!base) return all;
  const prefix = base + "/";
  return all.filter((f) => f.path.startsWith(prefix));
}
function resolveBookNote(app, name) {
  if (!name) return null;
  const byLink = app.metadataCache.getFirstLinkpathDest ? app.metadataCache.getFirstLinkpathDest(name, "") : null;
  if (byLink instanceof TFile) return byLink;
  const base = bookNotesFolderPath(app);
  const direct = app.vault.getAbstractFileByPath(erPath(base ? `${base}/${name}.md` : `${name}.md`));
  if (direct instanceof TFile) return direct;
  const hit = app.metadataCache.getFirstLinkpathDest(name, "");
  return hit instanceof TFile ? hit : null;
}
const BookNotePicker = class extends FuzzySuggestModal {
  constructor(app, files, onChoose) {
    super(app);
    this._files = files;
    this._onChoose = onChoose;
    this.setPlaceholder(__ertr("Заметка книги для ссылок — начните вводить название…"));
  }
  getItems() {
    return this._files;
  }
  getItemText(f) {
    return f.basename;
  }
  onChooseItem(f) {
    this._onChoose(f);
  }
};
const BookQuickOpen = class extends FuzzySuggestModal {
  constructor(app, plugin) {
    super(app);
    this.plugin = plugin;
    this.setPlaceholder(__ertr("Какую книгу открыть?"));
  }
  getItems() {
    const prog = this.plugin.progress || {};
    const started = (f) => {
      const p = prog[f.path];
      return p && typeof p.pct === "number" && p.pct > 0 ? p.pct : -1;
    };
    return this.plugin.bookFiles().sort((a, b) => {
      const sa = started(a), sb = started(b);
      if (sa >= 0 !== sb >= 0) return sa >= 0 ? -1 : 1;
      return a.basename.localeCompare(b.basename);
    });
  }
  getItemText(f) {
    const p = (this.plugin.progress || {})[f.path];
    const pct = p && typeof p.pct === "number" ? Math.round(p.pct * 100) : 0;
    return pct > 0 ? `${f.basename} — ${pct}%` : f.basename;
  }
  onChooseItem(f) {
    this.plugin.openFile(f);
  }
};
const TemplatePicker = class extends FuzzySuggestModal {
  constructor(app, files, onChoose) {
    super(app);
    this._files = files;
    this._onChoose = onChoose;
    this.setPlaceholder(__ertr("Шаблон заметки — начните вводить путь…"));
  }
  getItems() {
    return this._files;
  }
  getItemText(f) {
    return f.path;
  }
  onChooseItem(f) {
    this._onChoose(f);
  }
};
const FolderSuggest = AbstractInputSuggest ? class extends AbstractInputSuggest {
  constructor(app, inputEl) {
    super(app, inputEl);
    this._inputEl = inputEl;
  }
  getSuggestions(query) {
    const q = (query || "").toLowerCase();
    let out = [];
    for (const f of this.app.vault.getAllLoadedFiles()) {
      if (f instanceof TFolder && f.path && f.path.toLowerCase().includes(q)) out.push(f.path);
    }
    return out.sort().slice(0, 50);
  }
  renderSuggestion(path5, el) {
    el.setText(path5);
  }
  selectSuggestion(path5) {
    this._inputEl.value = path5;
    this._inputEl.dispatchEvent(new Event("input"));
    this._inputEl.dispatchEvent(new Event("er-path-pick"));
    this.close();
  }
} : null;
function attachFolderSuggest(app, textComp) {
  try {
    if (FolderSuggest && textComp && textComp.inputEl) new FolderSuggest(app, textComp.inputEl);
  } catch (e) {
    console.warn("Book Reader: folder suggest unavailable", e);
  }
}
function attachPathInput(app, textComp, commit) {
  attachFolderSuggest(app, textComp);
  const el = textComp.inputEl;
  let dirty = false;
  textComp.onChange(() => {
    dirty = true;
  });
  const flush = () => {
    if (!dirty) return;
    dirty = false;
    commit(el.value.trim());
  };
  el.addEventListener("blur", flush);
  el.addEventListener("er-path-pick", flush);
  el.addEventListener("keydown", (e) => {
    if (e.key !== "Enter") return;
    e.preventDefault();
    flush();
  });
  return textComp;
}
async function appendLinkToBookNote(app, plugin, bookFile, newFile) {
  try {
    const name = bookNoteLinkFor(plugin, bookFile);
    if (!name) return;
    const noteFile = resolveBookNote(app, name);
    if (!noteFile || noteFile.path === newFile.path) return;
    const heading = __ertr("## Заметки из выделений");
    const link = `- [[${newFile.basename}]]`;
    const add = (data) => {
      const base = data.replace(/\s*$/, "");
      return data.includes(heading) ? `${base}
${link}
` : `${base}

${heading}
${link}
`;
    };
    if (typeof app.vault.process === "function") await app.vault.process(noteFile, add);
    else await app.vault.modify(noteFile, add(await app.vault.read(noteFile)));
  } catch (e) {
    console.error("Elton Reader: append to book note failed", e);
  }
}
const RESERVED_NAMES = /^(CON|PRN|AUX|NUL|COM[1-9]|LPT[1-9])$/i;
function sanitizeNoteTitle(raw, max = 100) {
  // Control characters are exactly what has to go from a file name.
  // eslint-disable-next-line no-control-regex -- stripping them is the point
  let t = (raw || "").replace(/[\\/:*?"<>|#^[\]]/g, "").replace(/[\x00-\x1F\x7F]/g, "").replace(/\s+/g, " ").trim();
  t = t.replace(/^[.\s]+/, "").replace(/[.\s]+$/, "");
  if (t.length > max) t = t.slice(0, max).replace(/[.\s]+$/, "");
  if (!t) t = __ertr("Заметка");
  if (RESERVED_NAMES.test(t)) t = `_${t}`;
  return t;
}
function suggestNoteTitle(text, max = 60) {
  const clean = (text || "").replace(/\s+/g, " ").trim();
  if (!clean) return "";
  if (clean.length <= max) return clean.replace(/[.,;:!?…\s]+$/, "");
  const m = clean.match(/^(.{10,}?[.!?…])(\s|$)/);
  if (m && m[1].length <= max && /[\p{L}]{3}[.!?…]+$/u.test(m[1])) {
    return m[1].replace(/[.,;:!?…\s]+$/, "");
  }
  let cut = clean.slice(0, max + 1);
  const sp = cut.lastIndexOf(" ");
  if (sp > max * 0.5) cut = cut.slice(0, sp);
  return cut.replace(/\s+[a-zа-яё]{1,2}$/i, "").replace(/[.,;:!?…\-—\s]+$/, "");
}
const ReadSettingsModal = class extends Modal {
  constructor(app, view) {
    super(app);
    this.view = view;
  }
  // Тема применяется мгновенно, остальное требует перевёрстки. Обе читалки
  // называют свои методы по-разному, поэтому зовём то, что есть.
  async _apply(нуженПересчёт) {
    const v = this.view;
    // Записывать data.json на КАЖДОЕ нажатие — это и есть та самая задержка:
    // на телефоне запись идёт через хранилище и синхронизацию, и интерфейс
    // стоит. Вид меняем сразу, а на диск кладём, когда перестали тыкать.
    window.clearTimeout(this._saveT);
    this._saveT = window.setTimeout(() => { v.plugin.saveAll(); }, 500);
    if (typeof v.applyVars === "function") v.applyVars();
    if (typeof v._applyTheme === "function") v._applyTheme();
    // ВАЖНО: _applyContentStyle на телефоне — это ПОЛНАЯ пересборка книги
    // (см. ReaderModal). Вызывать его на каждое нажатие нельзя: смена темы —
    // это только цвета, а книга пересобиралась целиком, и на большом PDF это
    // те самые 10–20 секунд ожидания.
    if (нуженПересчёт && v.bookHtml) {
      // Абзац, на котором стоит читатель, снимается ДО пересборки и
      // восстанавливается ПОСЛЕ. Любая новая раскладка — это другая нарезка на
      // развороты, и попытка пересчитать позицию внутри самой пересборки
      // регулярно выбрасывала книгу в самый конец.
      let block = null;
      try { block = v.pager ? v.pager.currentBlockIndex() : null; } catch { /* optional step; a failure here must not interrupt reading */ }
      if (v.file && v.pager && typeof block === "number" && block >= 0) {
        await v.plugin.saveProgress(v.file.path, v.pager.spread, v.pager.total, block);
      }
      if (typeof v.repaginate === "function") await v.repaginate();
      else if (typeof v._repaginate === "function") await v._repaginate();
      if (v.pager && typeof block === "number" && block >= 0) {
        const [cur, tot] = v.pager.jumpTo(v.pager.spreadForBlock(block));
        const ui = v.updateUI || v._updateUI;
        if (typeof ui === "function") ui.call(v, cur, tot);
        if (v.file) await v.plugin.saveProgress(v.file.path, cur, tot, block);
      }
    }
    this._paintPreview();
  }
  _paintPreview() {
    const p = this.previewEl;
    if (!p) return;
    const s = this.view.plugin.settings;
    const t = erTheme(s);
    p.style.fontFamily = FONTS[s.fontFamily] || FONTS.georgia;
    p.style.fontSize = `${s.fontSize || 18}px`;
    p.style.lineHeight = String(s.lineHeight || 1.8);
    p.style.textAlign = s.textAlign || "left";
    p.style.background = t.bg;
    p.style.color = t.text;
  }
  // Один переключатель: подпись сверху, ячейки равной ширины. Именно разнобой
  // ширин и переносил кнопки на вторую строку в старой панели.
  _seg(host, label, items, current, onPick, hint, компактный) {
    host.createDiv("er-pan-sec").setText(label);
    const row = host.createDiv("er-col-row er-rs-seg" + (компактный ? " er-rs-num" : ""));
    const btns = [];
    for (const [value, text, шрифт] of items) {
      const b = row.createDiv("er-col-btn");
      b.setText(text);
      if (шрифт) b.style.fontFamily = шрифт;
      if (value === current()) b.addClass("active");
      b.addEventListener("click", async () => {
        for (const x of btns) x.removeClass("active");
        b.addClass("active");
        await onPick(value);
      });
      btns.push(b);
    }
    if (hint) host.createDiv("er-pan-hint").setText(hint);
    return row;
  }
  onOpen() {
    const v = this.view;
    const s = v.plugin.settings;
    this.modalEl.addClass("er-rs-modal");
    const c = this.contentEl;
    c.empty();
    c.addClass("er-rs");
    const head = c.createDiv("er-rs-head");
    head.createDiv("er-rs-title").setText(__ertr("Настройки чтения"));
    head.createDiv("er-rs-subtitle").setText(__ertr("Настройки применяются сразу и сохраняются автоматически."));
    this.previewEl = c.createDiv("er-rs-preview");
    this.previewEl.setText(__ertr("Так будет выглядеть текст книги"));
    this._paintPreview();
    c.addEventListener("click", () => window.setTimeout(() => this._paintPreview(), 80), true);

    // Apple Books keeps the two most frequently adjusted controls at the first
    // level: page appearance and text size. Everything else follows in clear
    // groups, with uncommon reading behaviour behind one disclosure row.
    const quick = c.createDiv("er-rs-quick");
    const appearance = quick.createDiv("er-rs-card er-rs-card-wide");
    const size = quick.createDiv("er-rs-card er-rs-card-size");
    this._seg(
      appearance,
      __ertr("Тема"),
      [["auto", __ertr("Как в Obsidian")], ["light", __ertr("Светлая")], ["sepia", __ertr("Сепия")], ["dark", __ertr("Тёмная")], ["eink", __ertr("Электронные чернила")]],
      () => s.einkMode ? "eink" : s.theme,
      async (t) => {
        if (t === "eink") s.einkMode = true;
        else {
          s.einkMode = false;
          s.theme = t;
        }
        await this._apply(false);
      }
    );
    size.createDiv("er-pan-sec").setText(__ertr("Размер шрифта"));
    const szRow = size.createDiv("er-sz-row er-rs-size-control");
    const szMinus = szRow.createDiv("er-sz-btn");
    szMinus.setText("A−");
    const szLbl = szRow.createDiv("er-sz-label");
    szLbl.setText(`${s.fontSize}px`);
    const szPlus = szRow.createDiv("er-sz-btn");
    szPlus.setText("A+");
    const chSz = async (d) => {
      s.fontSize = Math.min(32, Math.max(12, (s.fontSize || 18) + d));
      szLbl.setText(`${s.fontSize}px`);
      await this._apply(true);
    };
    szMinus.addEventListener("click", () => chSz(-1));
    szPlus.addEventListener("click", () => chSz(1));

    const grid = c.createDiv("er-rs-grid");
    const colA = grid.createDiv("er-rs-col er-rs-card");
    const colB = grid.createDiv("er-rs-col er-rs-card");
    colA.createDiv("er-rs-h").setText(__ertr("Текст и шрифт"));
    this._seg(
      colA,
      __ertr("Шрифт"),
      erReaderFonts().map((font) => [font.id, erFontLabel(font), font.stack]),
      () => s.fontFamily,
      async (f) => {
        s.fontFamily = f;
        await this._apply(true);
      }
    );
    const шаги = [1.4, 1.6, 1.8, 2.1];
    this._seg(
      colA,
      __ertr("Межстрочный"),
      [[1.4, __ertr("Компактно")], [1.6, __ertr("Обычно")], [1.8, __ertr("Комфортно")], [2.1, __ertr("Свободно")]],
      () => шаги.find((x) => Math.abs((s.lineHeight || 1.8) - x) < 0.05),
      async (x) => {
        s.lineHeight = x;
        await this._apply(true);
      },
      null,
      true
    );
    colB.createDiv("er-rs-h").setText(__ertr("Параметры страницы"));
    this._seg(
      colB,
      __ertr("Как листать"),
      [["pages", __ertr("Страницы")], ["scroll", __ertr("Прокрутка")]],
      () => s.readMode || "pages",
      async (m) => {
        if (m === (s.readMode || "pages")) return;
        const reader = this.view;
        try {
          if (reader.file && reader.pager) {
            await reader.plugin.saveProgress(reader.file.path, reader.pager.spread, reader.pager.total, reader.pager.currentBlockIndex());
          }
        } catch { /* optional step; a failure here must not interrupt reading */ }
        s.readMode = m;
        await this._apply(false);
        const file = reader.file;
        if (!file) return;
        if (typeof reader.openFile === "function") await reader.openFile(file);
        else if (typeof reader._loadBook === "function") await reader._loadBook();
      }
    );
    // Две страницы рядом физически не помещаются на телефоне: раскладка сама
    // требует ширину больше 700px, то есть настройка там ничего не делала и
    // только сбивала с толку. Планшету и компьютеру она нужна, им и показываем.
    if (erDeviceKey() !== "phone") this._seg(
      colB,
      __ertr("Страниц рядом"),
      [["1", __ertr("Одна")], ["2", __ertr("Две")]],
      () => String(s.columns || "2"),
      async (n) => {
        s.columns = n;
        await this._apply(true);
      },
      __ertr("Две страницы разворачиваются только на широком экране.")
    );
    // На телефоне колонка и так узкая: 60–90 знаков в строку туда не влезают,
    // то есть настройка ничего не меняла. Планшету и компьютеру она нужна.
    if (erDeviceKey() !== "phone") this._seg(
      colB,
      __ertr("Ширина строки"),
      [[0, __ertr("Авто")], [60, "60"], [70, "70"], [80, "80"], [90, "90"]],
      () => Number(s.maxLineCh) || 0,
      async (n) => {
        s.maxLineCh = n;
        await this._apply(true);
      },
      __ertr("Сколько знаков помещается в строку. Короткая строка читается легче."),
      true
    );

    const more = c.createDiv("er-rs-more");
    const moreBody = panelSection(v, more, {
      label: __ertr("Доп. настройки"),
      emoji: "",
      settingKey: "readerAdvOpen"
    });
    buildReaderExtraSettings(v, moreBody);
    const foot = c.createDiv("er-rs-foot");
    if (typeof v._renderHistory === "function") {
      foot.createDiv("er-pan-sec").setText(__ertr("Вернуться к месту"));
      v._histRow = foot.createDiv("er-hist-row");
      v._renderHistory();
    }
    const act = foot.createDiv("er-act-row");
    const help = act.createDiv("er-act-btn");
    iconLabel(help, "info", __ertr("Справка"));
    help.addEventListener("click", () => {
      this.close();
      new InfoModal(this.app, v.plugin, v.file).open();
    });
  }
  onClose() {
    // Настройки пишутся с задержкой; окно закрыли раньше — дописываем сразу.
    window.clearTimeout(this._saveT);
    if (this.view && this.view.plugin) this.view.plugin.saveAll();
    if (this.view) this.view._histRow = null;
    this.contentEl.empty();
  }
};
function parseNoteTags(raw) {
  return String(raw || "").replace(/\s+#/g, ",#").split(/[,;\n]+/).map((t) => t.trim().replace(/^#+/, "").replace(/\s+/g, "-")).filter(Boolean).filter((t, i, a) => a.indexOf(t) === i);
}
function allVaultTags(app) {
  try {
    const counts = app.metadataCache && app.metadataCache.getTags && app.metadataCache.getTags();
    if (!counts) return [];
    return Object.keys(counts).map((t) => t.replace(/^#/, "")).sort((a, b) => (counts["#" + b] || 0) - (counts["#" + a] || 0)).slice(0, 60);
  } catch {
    return [];
  }
}
const NoteTitleModal = class extends Modal {
  constructor(app, plugin, fragment, bookFile, onDone) {
    super(app);
    this.plugin = plugin;
    this.fragment = fragment;
    this.bookFile = bookFile || null;
    this.onDone = onDone;
    this._answered = false;
  }
  onOpen() {
    const c = this.contentEl;
    c.addClass("er-title-modal");
    c.createDiv("er-info-title").setText(__ertr("Новая заметка из выделения"));
    const field = (label, hint) => {
      const w = c.createDiv("er-setup-field");
      w.createDiv("er-setup-label").setText(label);
      const el = w.createEl("input", { type: "text" });
      el.addClass("er-setup-input");
      if (hint) el.placeholder = hint;
      return el;
    };
    const input = field(__ertr("Название"));
    input.value = suggestNoteTitle(this.fragment);
    const full = sanitizeNoteTitle(this.fragment);
    if (full && full !== input.value) {
      const useFull = c.createDiv("er-title-alt");
      useFull.setText(__ertr("Взять весь фрагмент как название"));
      useFull.addEventListener("click", () => {
        input.value = full;
        input.focus();
      });
    }
    const folderInput = field(__ertr("Папка"), notesFolderPath(this.app) || __ertr("Корень хранилища"));
    folderInput.value = this.plugin.settings.lastNoteFolder || "";
    try {
      if (FolderSuggest) new FolderSuggest(this.app, folderInput);
    } catch { /* optional step; a failure here must not interrupt reading */ }
    const tagsInput = field(__ertr("Теги"), __ertr("Например: идеи, психология"));
    tagsInput.value = this.plugin.settings.lastNoteTags || "";
    const known = allVaultTags(this.app);
    if (known.length) {
      const dl = c.createEl("datalist");
      dl.id = "er-note-tags-" + Math.random().toString(36).slice(2, 8);
      known.forEach((t) => dl.createEl("option", { value: t }));
      tagsInput.setAttr("list", dl.id);
    }
    c.createDiv("er-setup-hint").setText(__ertr("Папка и теги запомнятся для следующей заметки. Сам фрагмент попадёт в текст целиком — название на это не влияет."));
    const foot = c.createDiv("er-setup-foot");
    const ok = foot.createEl("button", { text: __ertr("Создать заметку") });
    ok.addClass("er-setup-btn", "er-setup-btn-primary");
    // Второй выход из этой же модалки. Люди ждут, что вторая и третья цитата
    // лягут в ту же заметку книги, а не расплодят файлы: кнопка даёт это
    // выбрать прямо здесь, не выключая обычные отдельные заметки в настройках.
    const bookNote = this.bookFile ? bookNoteLinkFor(this.plugin, this.bookFile) : "";
    if (bookNote) {
      const toBook = foot.createEl("button", { text: __ertr("В заметку книги") });
      toBook.addClass("er-setup-btn", "er-setup-btn-quiet");
      toBook.setAttribute("aria-label", __ertr("Дописать цитату в «{0}» вместо отдельной заметки", bookNote));
      toBook.addEventListener("click", () => {
        this._answered = true;
        this.close();
        this.onDone({ toBookNote: true });
      });
    }
    const cancel = foot.createEl("button", { text: __ertr("Отмена") });
    cancel.addClass("er-setup-btn", "er-setup-btn-quiet");
    const submit = async () => {
      const v = input.value.trim();
      if (!v) {
        input.focus();
        return;
      }
      this._answered = true;
      const folder = erPath(folderInput.value.trim());
      const tags = parseNoteTags(tagsInput.value);
      this.plugin.settings.lastNoteFolder = folder;
      this.plugin.settings.lastNoteTags = tagsInput.value.trim();
      try {
        await this.plugin._saveLocalData();
      } catch { /* optional step; a failure here must not interrupt reading */ }
      this.close();
      this.onDone({ title: v, folder, tags });
    };
    ok.addEventListener("click", submit);
    cancel.addEventListener("click", () => this.close());
    for (const el of [input, folderInput, tagsInput]) {
      el.addEventListener("keydown", (e) => {
        if (e.key === "Enter") {
          e.preventDefault();
          submit();
        }
      });
    }
    erAutoFocus(input, 30);
  }
  onClose() {
    this.contentEl.empty();
    if (!this._answered) this.onDone(null);
  }
};
function processTemplateManually(tplText, title) {
  let today;
  try {
    today = window.moment ? window.moment().format("YYYY-MM-DD") : (/* @__PURE__ */ new Date()).toISOString().slice(0, 10);
  } catch {
    today = (/* @__PURE__ */ new Date()).toISOString().slice(0, 10);
  }
  return tplText.replace(/<%[-_]?\s*tp\.file\.title\s*[-_]?%>/g, title).replace(/<%[-_]?\s*tp\.date\.now\([^)]*\)\s*[-_]?%>/g, today).replace(/<%[-_]?\s*tp\.file\.cursor\([^)]*\)\s*[-_]?%>/g, "").replace(/<%[\s\S]*?%>/g, "");
}
function bookNoteLinkFor(plugin, bookFile) {
  let _a, _b;
  if (!bookFile) return "";
  const map = (_a = plugin == null ? void 0 : plugin.settings) == null ? void 0 : _a.bookNoteLinks;
  const raw = map ? (_b = map[bookFile.path]) != null ? _b : "" : "";
  const fromSettings = String(raw).trim().replace(/^\[\[|\]\]$/g, "").trim();
  if (fromSettings) return fromSettings;
  return bookNoteFromFrontmatter(plugin, bookFile);
}
function isUnsafeReadingNote(app, note) {
  if (!(note instanceof TFile)) return true;
  if (/(^|\/)(?:_?templates?|模板)(\/|$)/i.test(note.path)) return true;
  const cache = app.metadataCache.getFileCache(note);
  const fm = cache && cache.frontmatter || {};
  const type = String(fm.type || "").trim().toLowerCase();
  return ["person", "people", "meeting", "daily", "project", "template"].includes(type);
}
function isMarkedReadingNote(app, note) {
  if (!(note instanceof TFile) || isUnsafeReadingNote(app, note)) return false;
  const cache = app.metadataCache.getFileCache(note);
  const fm = cache && cache.frontmatter || {};
  const type = String(fm.type || "").trim().toLowerCase();
  return fm["book-reader-note"] === true || ["reading-note", "book-note"].includes(type);
}
function stripGeneratedReadingNoteTitle(data, title) {
  const original = String(data || "");
  const lines = original.split(/\r?\n/);
  let i = 0;
  if (lines[0] === "---") {
    i = 1;
    while (i < lines.length && lines[i] !== "---") i++;
    if (i < lines.length) i++;
  }
  while (i < lines.length && !lines[i].trim()) i++;
  if (!/^#\s+/.test(lines[i])) return original;
  const heading = lines[i].replace(/^#\s+/, "").trim();
  const filename = String(title || "").trim();
  const sameGeneratedTitle = heading === filename
    || (filename.startsWith(heading) && /^[（(]/.test(filename.slice(heading.length).trimStart()));
  if (!sameGeneratedTitle) return original;
  let next = i + 1;
  while (next < lines.length && !lines[next].trim()) next++;
  if (next < lines.length && !/^## (?:划线与批注|旧版摘录|Quotes|Цитаты|Старые цитаты)\s*$/.test(lines[next])) return original;
  lines.splice(i, next - i);
  return lines.join("\n").replace(/^(---\n[\s\S]*?\n---)\n{3,}/, "$1\n\n");
}
function bookNoteFromFrontmatter(plugin, bookFile) {
  let _a;
  try {
    const app = plugin && plugin.app;
    if (!app || !bookFile) return "";
    const want = erPath(bookFile.path);
    const wantName = bookFile.basename;
    for (const md of app.vault.getMarkdownFiles()) {
      // A generic `book` property means only "related to this book". It must
      // never promote a person/project/template note to the canonical reading
      // note. Only notes explicitly marked by Book Reader are eligible.
      if (!isMarkedReadingNote(app, md)) continue;
      const fm = app.metadataCache.getFileCache(md);
      const v = fm && fm.frontmatter && ((_a = fm.frontmatter.book) != null ? _a : fm.frontmatter["annotation-target"]);
      if (!v) continue;
      const target = String(v).trim().replace(/^\[\[|\]\]$/g, "").split("|")[0].trim();
      if (!target) continue;
      if (erPath(target) === want || target === wantName) return md.basename;
    }
  } catch { /* optional step; a failure here must not interrupt reading */ }
  return "";
}
async function writeBookProperty(app, noteName, bookFile) {
  try {
    if (!noteName || !bookFile) return;
    const note = resolveBookNote(app, noteName);
    if (!note) return;
    await app.fileManager.processFrontMatter(note, (fm) => {
      fm.book = `[[${bookFile.path}]]`;
      if (!fm.type) fm.type = "reading-note";
      fm["book-reader-note"] = true;
    });
  } catch (e) {
    console.warn("Book Reader: could not write the book property into the note", e);
  }
}
async function createNoteFromSelection(app, plugin, selText, bookFile, opts = {}) {
  let _a, _b;
  const {
    open = true,
    silent = false,
    reserved = null,
    color = null,
    extra = "",
    openMode = null,
    openBackground = false
  } = opts;
  const clean = (selText || "").replace(/[ \t]+/g, " ").replace(/\s*\n\s*/g, " ").trim();
  if (!clean) {
    if (!silent) new Notice(__ertr("Пустое выделение"));
    return null;
  }
  let title = sanitizeNoteTitle(clean);
  let chosenFolder = null, chosenTags = [];
  if (!silent && plugin.settings.askNoteTitle !== false) {
    const chosen = await new Promise((resolve) => {
      new NoteTitleModal(app, plugin, clean, bookFile, resolve).open();
    });
    if (chosen === null) return null;
    if (chosen.toBookNote) {
      const base = opts.hl && typeof opts.hl === "object" ? opts.hl : {};
      await exportHighlightsToBookNote(app, plugin, bookFile, [{ ...base, text: clean, color: color != null ? color : base.color }]);
      return null;
    }
    title = sanitizeNoteTitle(chosen.title);
    chosenFolder = chosen.folder || null;
    chosenTags = chosen.tags || [];
  } else if (!silent && plugin.settings.shortNoteTitles) {
    title = sanitizeNoteTitle(suggestNoteTitle(clean));
  }
  if (!chosenFolder && plugin.settings.notesNextToBook && bookFile && bookFile.parent) {
    const beside = erPath(bookFile.parent.path || "");
    if (beside) chosenFolder = beside;
  }
  let filename = title, n = 2;
  const taken = (name) => app.vault.getAbstractFileByPath(inboxNotePath(app, name, chosenFolder)) || reserved && reserved.has(name);
  while (taken(filename)) filename = `${title} ${n++}`;
  if (reserved) reserved.add(filename);
  const linkName = bookFile ? bookNoteLinkFor(plugin, bookFile) || bookFile.basename : "";
  const src = bookFile ? __ertr("\n\n— из [[{0}]]", linkName) : "";
  const marked = color ? hlMark(app, clean.replace(/\n/g, "\n> "), color) : clean.replace(/\n/g, "\n> ");
  const tagLine = chosenTags.length ? chosenTags.map((t) => "#" + t).join(" ") + "\n\n" : "";
  const quote = `${tagLine}> ${marked}${extra}${src}`;
  const cursorRe = /<%\s*tp\.file\.cursor\([^)]*\)\s*%>/;
  const cursorReAll = /<%\s*tp\.file\.cursor\([^)]*\)\s*%>/g;
  try {
    const tplPlugin = (_b = (_a = app.plugins) == null ? void 0 : _a.plugins) == null ? void 0 : _b["templater-obsidian"];
    const templater = tplPlugin == null ? void 0 : tplPlugin.templater;
    const _tplPath = noteTemplatePath(app, bookFile);
    const templateFile = _tplPath ? app.vault.getAbstractFileByPath(_tplPath) : null;
    let folder = await resolveNotesFolder(app, chosenFolder);
    let newFile = null;
    if (templater && templateFile && folder && typeof templater.create_new_note_from_template === "function") {
      newFile = await templater.create_new_note_from_template(templateFile, folder, filename, false);
      if (!newFile) newFile = app.vault.getAbstractFileByPath(inboxNotePath(app, filename, chosenFolder));
      if (newFile) {
        const transform = (data) => {
          let out = cursorRe.test(data) ? data.replace(cursorRe, `
${quote}
`) : `${data.replace(/\s*$/, "")}

${quote}
`;
          return out.replace(cursorReAll, "");
        };
        if (typeof app.vault.process === "function") await app.vault.process(newFile, transform);
        else await app.vault.modify(newFile, transform(await app.vault.read(newFile)));
      }
    } else {
      let body = "";
      if (templateFile) {
        try {
          body = processTemplateManually(await app.vault.read(templateFile), filename);
        } catch { /* optional step; a failure here must not interrupt reading */ }
      }
      newFile = await app.vault.create(inboxNotePath(app, filename, chosenFolder), `${body}

${quote}
`);
    }
    if (newFile) {
      if (!silent && bookFile) await appendLinkToBookNote(app, plugin, bookFile, newFile);
      if (open) await openNoteBesideBook(app, plugin, newFile, null, { mode: openMode, background: openBackground });
      if (!silent) new Notice(__ertr("Заметка создана"));
    }
    return newFile;
  } catch (e) {
    console.error("Elton Reader: note creation failed", e);
    if (!silent) new Notice(__ertr("Не удалось создать заметку"));
    return null;
  }
}
function _escHtml(s) {
  return String(s).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
}
function hlMark(app, text, colorId) {
  const c = HL_COLORS.find((x) => x.id === colorId);
  if (!c || _readerSettings(app).exportColors === false) return text;
  return `<mark style="background:${c.css}">${_escHtml(text)}</mark>`;
}
function normalizeHlText(s) {
  return String(s || "").replace(/<[^>]*>/g, " ").replace(/==+/g, " ").replace(/^\s*>+\s?/gm, " ").replace(/\s+/g, " ").trim().toLowerCase();
}
function splitExportedHighlights(noteText, highlights) {
  const hay = normalizeHlText(noteText);
  const fresh = [], already = [];
  for (const hl of highlights || []) {
    const needle = normalizeHlText(hl && hl.text);
    if (needle && hay && hay.includes(needle)) already.push(hl);
    else fresh.push(hl);
  }
  return { fresh, already };
}
async function openNoteBesideBook(app, plugin, file, line, opts = {}) {
  const mode = opts.mode || plugin && plugin.settings && plugin.settings.noteOpenMode || "split";
  if (mode === "none" || !file) return null;
  const back = opts.background === true;
  const prev = back ? app.workspace.getMostRecentLeaf() : null;
  const leaf = app.workspace.getLeaf(mode === "tab" ? "tab" : "split");
  await leaf.openFile(file, back ? { active: false } : void 0);
  if (back && prev) app.workspace.setActiveLeaf(prev, { focus: true });
  if (typeof line === "number" && line > 0) {
    try {
      const view = leaf.view;
      if (view && view.editor) view.editor.setCursor({ line, ch: 0 });
    } catch { /* optional step; a failure here must not interrupt reading */ }
  }
  return leaf;
}
async function openOrCreateBookNoteBeside(plugin, bookFile) {
  if (!(plugin && bookFile)) return null;
  let name = bookNoteLinkFor(plugin, bookFile);
  let note = name ? resolveBookNote(plugin.app, name) : null;
  if (!(note instanceof TFile)) {
    if (name && plugin.settings.bookNoteLinks) delete plugin.settings.bookNoteLinks[bookFile.path];
    note = await plugin.ensureBookNote(bookFile);
  }
  if (!(note instanceof TFile)) {
    new Notice(__ertr("Не удалось открыть заметку книги"));
    return null;
  }
  const openLeaf = plugin.app.workspace.getLeavesOfType("markdown")
    .find((leaf) => leaf.view && leaf.view.file && leaf.view.file.path === note.path);
  if (openLeaf) {
    plugin.app.workspace.revealLeaf(openLeaf);
    return openLeaf;
  }
  return openNoteBesideBook(plugin.app, plugin, note, null, { mode: "split" });
}
function addBookFileMenu(app, menu, file) {
  if (!file) return menu;
  menu.addSeparator();
  menu.addItem((it) => it.setTitle(__ertr("Показать в списке файлов")).setIcon("folder-open").onClick(() => {
    const explorer = app.workspace.getLeavesOfType("file-explorer")[0];
    if (!explorer) return;
    app.workspace.revealLeaf(explorer);
    const tree = explorer.view;
    if (tree && typeof tree.revealInFolder === "function") tree.revealInFolder(file);
  }));
  app.workspace.trigger("file-menu", menu, file, "elton-reader");
  return menu;
}
function deleteBookFromVault(app, plugin, file, after) {
  if (!file) return;
  new ConfirmModal(app, {
    title: __ertr("Удалить книгу?"),
    body: __ertr("\xAB{0}\xBB будет удалена из хранилища вместе с прогрессом чтения и выделениями. Заметка книги останется на месте.", file.basename),
    okText: __ertr("Удалить"),
    cancelText: __ertr("Отмена"),
    onYes: async () => {
      try {
        await app.fileManager.trashFile(file);
        const path5 = file.path;
        if (plugin.progress) delete plugin.progress[path5];
        if (plugin.progressBackups) delete plugin.progressBackups[path5];
        if (plugin.highlights) delete plugin.highlights[path5];
        if (plugin.settings && plugin.settings.coverFits) delete plugin.settings.coverFits[path5];
        await plugin.saveAll();
        new Notice(__ertr("Книга удалена: {0}", file.basename));
        if (typeof after === "function") after();
      } catch (e) {
        console.error("Elton Reader: delete book failed", e);
        new Notice(__ertr("Не удалось удалить книгу"));
      }
    }
  }).open();
}
const QUOTE_TEMPLATE_DEFAULT = "> {text}\n\n— из [[{book}]]{page}{link}";
// Keep the backlink useful without inserting interface prose into the reader's
// notes. The arrow is the complete visible label; old custom text settings are
// intentionally ignored so copied quotations stay clean.
function backlinkLabel() { return "↩"; }
function quoteMarkdown(plugin, hl, bookFile) {
  const clean = String(hl && hl.text || "").replace(/[ \t]+/g, " ").replace(/\s*\n\s*/g, " ").trim();
  if (!clean) return "";
  const bookName = bookFile ? bookNoteLinkFor(plugin, bookFile) || bookFile.basename : "";
  const page = hl && hl.page ? __ertr(", стр. {0}", hl.page) : "";
  let link = "";
  if (plugin.settings.quoteBacklinks !== false && bookFile && typeof hl.block === "number" && hl.block >= 0) {
    link = ` [${backlinkLabel()}](obsidian://qiaomu-book-reader?book=${encodeURIComponent(bookFile.path)}&block=${hl.block})`;
  }
  const commentText = hl && hl.comment ? String(hl.comment).trim() : "";
  const comment = commentText ? `\n\n**${__ertr("Комментарий к выделению")}：** ${commentText.replace(/\n/g, "\n\n")}` : "";
  const tpl = plugin.settings.quoteTemplate || QUOTE_TEMPLATE_DEFAULT;
  return tpl.split("{text}").join(clean + comment).split("{book}").join(bookName).split("{page}").join(page).split("{link}").join(link).split("{comment}").join(commentText).trim();
}
function hlCommentMd(hl) {
  const c = hl && hl.comment ? String(hl.comment).trim() : "";
  return c ? `\n\n**${__ertr("Комментарий к выделению")}：** ${c.replace(/\n/g, "\n\n")}` : "";
}
const LEGACY_READING_HIGHLIGHTS_RE = /<!-- book-reader:highlights:start -->[\s\S]*?<!-- book-reader:highlights:end -->/g;
const READING_SECTION_RE = /^##[ \t]+(?:划线与批注|Quotes|Цитаты)[ \t]*$/gm;
function readingSectionRanges(text) {
  const headings = [];
  READING_SECTION_RE.lastIndex = 0;
  for (const match of text.matchAll(READING_SECTION_RE)) headings.push({ start: match.index, headingEnd: match.index + match[0].length });
  return headings.map((heading) => {
    const next = /^##[ \t]+(?!#)/gm;
    next.lastIndex = heading.headingEnd;
    const found = next.exec(text);
    return { start: heading.start, end: found ? found.index : text.length };
  });
}
function replaceManagedReadingHighlights(data, block) {
  let text = String(data || "");
  const hadLegacyMarkers = LEGACY_READING_HIGHLIGHTS_RE.test(text);
  LEGACY_READING_HIGHLIGHTS_RE.lastIndex = 0;
  if (hadLegacyMarkers) {
    // Older builds exposed HTML sentinels in the note source. Remove the whole
    // generated block, but preserve any older untracked excerpts by renaming
    // their same-named section before the new source-of-truth section is added.
    text = text.replace(LEGACY_READING_HIGHLIGHTS_RE, "").replace(/\n{3,}/g, "\n\n");
    READING_SECTION_RE.lastIndex = 0;
    text = text.replace(READING_SECTION_RE, `## ${__ertr("Старые цитаты")}`);
    return `${text.replace(/\s*$/, "")}${block ? `\n\n${block}` : ""}\n`;
  }
  const ranges = readingSectionRanges(text);
  if (!ranges.length) return `${text.replace(/\s*$/, "")}${block ? `\n\n${block}` : ""}\n`;
  const insertAt = ranges[0].start;
  for (let i = ranges.length - 1; i >= 0; i--) {
    text = text.slice(0, ranges[i].start) + text.slice(ranges[i].end);
  }
  return `${text.slice(0, insertAt).replace(/\s*$/, "")}${block ? `\n\n${block}` : ""}${text.slice(insertAt)}`.replace(/\s*$/, "") + "\n";
}
function renderManagedReadingHighlights(plugin, bookFile, highlights) {
  const list = [...(highlights || [])].filter((hl) => hl && hl.text).sort((a, b) => (a.block || 0) - (b.block || 0) || (a.occ || 0) - (b.occ || 0));
  if (!list.length) return "";
  const rows = list.map((hl) => {
    const clean = String(hl.text).replace(/[ \t]+/g, " ").replace(/\s*\n\s*/g, " ").trim();
    let where = hl.page ? __ertr(" *(стр. {0})*", hl.page) : "";
    if (plugin.settings.quoteBacklinks !== false && typeof hl.block === "number" && hl.block >= 0) {
      const uri = `obsidian://qiaomu-book-reader?book=${encodeURIComponent(bookFile.path)}&block=${hl.block}`;
      where += ` [${backlinkLabel()}](${uri})`;
    }
    const comment = hl.comment
      ? `\n\n**${__ertr("Комментарий к выделению")}：** ${String(hl.comment).replace(/\n/g, "\n\n")}`
      : "";
    const chapter = hl.chapter ? `**${hl.chapter}**\n\n` : "";
    return `${chapter}> ${hlMark(plugin.app, clean, hl.color)}${where}${comment}`;
  });
  return `${__ertr("## Цитаты")}\n\n${rows.join("\n\n")}`;
}
async function syncHighlightsToReadingNote(app, plugin, bookPath, highlights) {
  try {
    const bookFile = app.vault.getAbstractFileByPath(bookPath);
    if (!(bookFile instanceof TFile)) return;
    let name = bookNoteLinkFor(plugin, bookFile);
    if (!name && plugin.settings.autoBookNote === true) {
      const created = await plugin.ensureBookNote(bookFile);
      name = created ? created.basename : bookNoteLinkFor(plugin, bookFile);
    }
    if (!name) return;
    const note = resolveBookNote(app, name);
    if (!(note instanceof TFile) || isUnsafeReadingNote(app, note)) return;
    const block = renderManagedReadingHighlights(plugin, bookFile, highlights);
    const update = (data) => replaceManagedReadingHighlights(data, block);
    if (typeof app.vault.process === "function") await app.vault.process(note, update);
    else await app.vault.modify(note, update(await app.vault.read(note)));
  } catch (e) {
    console.error("Book Reader: reading-note sync failed", e);
  }
}
async function exportHighlightsSeparate(app, plugin, bookFile, highlights) {
  if (!highlights || !highlights.length) {
    new Notice(__ertr("Нет выделений для экспорта"));
    return;
  }
  new Notice(__ertr("Создаю заметки: {0}…", highlights.length));
  const reserved = /* @__PURE__ */ new Set();
  let ok = 0, fail = 0;
  for (const hl of highlights) {
    const f = await createNoteFromSelection(app, plugin, hl.text, bookFile, { open: false, silent: true, reserved, extra: hlCommentMd(hl), color: hl.color });
    if (f) ok++;
    else fail++;
  }
  new Notice(fail ? __ertr("Создано заметок: {0}, ошибок: {1}", ok, fail) : __ertr("Создано заметок: {0}", ok));
}
async function openNoteInTab(app, file, line) {
  const leaf = app.workspace.getLeaf("tab");
  if (!leaf) return;
  const eState = typeof line === "number" ? { line, cursor: { from: { line, ch: 0 }, to: { line, ch: 0 } }, focus: true } : void 0;
  await leaf.openFile(file, eState ? { eState } : void 0);
}
const ConfirmModal = class extends Modal {
  constructor(app, opts) {
    super(app);
    this.opts = opts || {};
  }
  onOpen() {
    const { contentEl, modalEl } = this;
    modalEl.addClass("er-confirm-modal");
    contentEl.empty();
    if (this.opts.title) contentEl.createDiv("er-confirm-title").setText(this.opts.title);
    if (this.opts.body) contentEl.createDiv("er-confirm-body").setText(this.opts.body);
    const btns = contentEl.createDiv("er-confirm-btns");
    const no = btns.createEl("button", { text: this.opts.cancelText || __ertr("Нет") });
    no.addClass("er-confirm-no");
    no.addEventListener("click", () => {
      this._done = true;
      this.close();
      this.opts.onNo && this.opts.onNo();
    });
    const yes = btns.createEl("button", { text: this.opts.okText || __ertr("Да") });
    yes.addClass("er-confirm-yes");
    yes.addEventListener("click", () => {
      this._done = true;
      this.close();
      this.opts.onYes && this.opts.onYes();
    });
    window.setTimeout(() => yes.focus(), 0);
  }
  onClose() {
    this.contentEl.empty();
  }
};
const GoToPageModal = class extends Modal {
  constructor(app, total, current, onSubmit) {
    super(app);
    this.total = total;
    this.current = current || 0;
    this.onSubmit = onSubmit;
  }
  onOpen() {
    const { contentEl, modalEl } = this;
    modalEl.addClass("er-confirm-modal");
    contentEl.empty();
    contentEl.createDiv("er-confirm-title").setText(__ertr("Перейти к странице"));
    const input = contentEl.createEl("input", { cls: "er-gotopage-input", attr: { type: "number", min: "1", max: String(this.total), placeholder: `1–${this.total}` } });
    input.value = String(this.current + 1);
    const submit = () => {
      const n = parseInt(input.value, 10);
      this.close();
      if (!isNaN(n)) this.onSubmit(Math.max(1, Math.min(this.total, n)));
    };
    input.addEventListener("keydown", (e) => {
      if (e.key === "Enter") {
        e.preventDefault();
        submit();
      }
    });
    const btns = contentEl.createDiv("er-confirm-btns");
    const go = btns.createEl("button", { text: __ertr("Перейти") });
    go.addClass("er-confirm-yes");
    go.addEventListener("click", submit);
    erAutoFocus(input, 0);
  }
  onClose() {
    this.contentEl.empty();
  }
};
async function exportHighlightsToBookNote(app, plugin, bookFile, highlights) {
  if (!highlights || !highlights.length) {
    new Notice(__ertr("Нет выделений для экспорта"));
    return;
  }
  const name = bookFile ? bookNoteLinkFor(plugin, bookFile) : "";
  if (!name) {
    new Notice(__ertr("Для книги не привязана заметка — задайте её в настройках"));
    return;
  }
  const noteFile = resolveBookNote(app, name);
  if (!noteFile) {
    new Notice(__ertr("Заметка книги не найдена: {0}", name));
    return;
  }
  let existingText = "";
  try {
    existingText = await app.vault.read(noteFile);
  } catch {
    existingText = "";
  }
  const split = splitExportedHighlights(existingText, highlights);
  if (!split.fresh.length) {
    new Notice(split.already.length === 1 ? __ertr("Эта цитата уже есть в \xAB{0}\xBB", noteFile.basename) : __ertr("Все выбранные цитаты уже есть в \xAB{0}\xBB", noteFile.basename));
    return;
  }
  const skipped = split.already.length;
  highlights = split.fresh;
  const groups = [];
  for (const hl of highlights) {
    const clean = (hl.text || "").replace(/[ \t]+/g, " ").replace(/\s*\n\s*/g, " ").trim();
    if (!clean) continue;
    const chapter = hl.chapter || "";
    let g = groups.find((x) => x.chapter === chapter);
    if (!g) {
      g = { chapter, lines: [] };
      groups.push(g);
    }
    let where = hl.page ? __ertr(" *(стр. {0})*", hl.page) : "";
    if (plugin.settings.quoteBacklinks !== false && bookFile && typeof hl.block === "number" && hl.block >= 0) {
      const uri = `obsidian://qiaomu-book-reader?book=${encodeURIComponent(bookFile.path)}&block=${hl.block}`;
      where += ` [${backlinkLabel()}](${uri})`;
    }
    const cmt = hl.comment
      ? `\n\n**${__ertr("Комментарий к выделению")}：** ${hl.comment.replace(/\n/g, "\n\n")}`
      : "";
    g.lines.push(`> ${hlMark(app, clean, hl.color)}${where}${cmt}`);
  }
  const parts = groups.flatMap((g) => g.lines);
  if (!parts.length) {
    new Notice(__ertr("Нет выделений для экспорта"));
    return;
  }
  const heading = __ertr("## Цитаты");
  const block = groups.map((g) => (g.chapter ? `**${g.chapter}**

` : "") + g.lines.join("\n\n")).join("\n\n");
  let targetLine = 0;
  const add = (data) => {
    const base = data.replace(/\s*$/, "");
    const prefix = data.includes(heading) ? `${base}

` : `${base}

${heading}

`;
    targetLine = (prefix.match(/\n/g) || []).length;
    return `${prefix}${block}
`;
  };
  try {
    if (typeof app.vault.process === "function") await app.vault.process(noteFile, add);
    else await app.vault.modify(noteFile, add(await app.vault.read(noteFile)));
    new Notice(skipped ? __ertr("Добавлено в \xAB{0}\xBB: {1}, пропущено уже имевшихся: {2}", noteFile.basename, parts.length, skipped) : __ertr("Добавлено цитат в \xAB{0}\xBB: {1}", noteFile.basename, parts.length));
    new ConfirmModal(app, {
      title: __ertr("Цитаты добавлены"),
      body: __ertr("Открыть заметку \xAB{0}\xBB в отдельной вкладке?", noteFile.basename),
      okText: __ertr("Да, открыть"),
      cancelText: __ertr("Нет"),
      onYes: () => openNoteInTab(app, noteFile, targetLine)
    }).open();
  } catch (e) {
    console.error("Elton Reader: append quotes to book note failed", e);
    new Notice(__ertr("Не удалось добавить цитаты в заметку книги"));
  }
}
const HighlightExportModal = class extends Modal {
  constructor(app, plugin, bookFile, highlights, noteText, noteName) {
    super(app);
    this.plugin = plugin;
    this.bookFile = bookFile;
    this.noteName = noteName || "";
    const split = splitExportedHighlights(noteText, highlights);
    this.already = new Set(split.already);
    this.items = highlights.map((hl) => ({ hl, on: !split.already.includes(hl) }));
    this.newCount = split.fresh.length;
  }
  onOpen() {
    const c = this.contentEl;
    c.addClass("er-exp-modal");
    c.createDiv("er-info-title").setText(__ertr("Что перенести в заметку"));
    const sub = c.createDiv("er-info-sub");
    sub.setText(this.noteName ? this.already.size ? __ertr("Заметка \xAB{0}\xBB — {1} уже перенесено, отмечено {2} новых", this.noteName, this.already.size, this.newCount) : __ertr("Заметка \xAB{0}\xBB — все {1} ещё не перенесены", this.noteName, this.items.length) : __ertr("Заметка книги не привязана — доступны только отдельные заметки"));
    const bar = c.createDiv("er-exp-bar");
    const counter = bar.createSpan({ cls: "er-exp-count" });
    const mkLink = (label, fn) => {
      const a = bar.createSpan({ cls: "er-exp-link", text: label });
      a.addEventListener("click", () => {
        fn();
        refresh();
      });
      return a;
    };
    mkLink(__ertr("Выделить все"), () => this.items.forEach((i) => i.on = true));
    mkLink(__ertr("Снять все"), () => this.items.forEach((i) => i.on = false));
    if (this.already.size) mkLink(__ertr("Только новые"), () => this.items.forEach((i) => i.on = !this.already.has(i.hl)));
    const list = c.createDiv("er-exp-list");
    const rows = this.items.map((item) => {
      const row = list.createDiv("er-exp-row");
      const box = row.createEl("input", { type: "checkbox" });
      box.addClass("er-exp-box");
      box.checked = item.on;
      const body = row.createDiv("er-exp-body");
      const txt = (item.hl.text || "").replace(/\s+/g, " ").trim();
      body.createDiv("er-exp-text").setText(txt.length > 220 ? txt.slice(0, 220) + "…" : txt);
      if (this.already.has(item.hl)) {
        row.addClass("er-exp-done");
        body.createDiv("er-exp-tag").setText(__ertr("уже в заметке"));
      }
      const toggle = () => {
        item.on = !item.on;
        box.checked = item.on;
        refresh();
      };
      box.addEventListener("click", (e) => {
        e.stopPropagation();
        item.on = box.checked;
        refresh();
      });
      row.addEventListener("click", toggle);
      return { item, box };
    });
    const refresh = () => {
      for (const r of rows) r.box.checked = r.item.on;
      const n = this.items.filter((i) => i.on).length;
      counter.setText(__ertr("Отмечено: {0} из {1}", n, this.items.length));
      toNote.disabled = !n || !this.noteName;
      toSep.disabled = !n;
    };
    const foot = c.createDiv("er-setup-foot");
    const toNote = foot.createEl("button", { text: __ertr("В заметку книги") });
    toNote.addClass("er-setup-btn", "er-setup-btn-primary");
    const toSep = foot.createEl("button", { text: __ertr("Отдельными заметками") });
    toSep.addClass("er-setup-btn");
    const picked = () => this.items.filter((i) => i.on).map((i) => i.hl);
    toNote.addEventListener("click", () => {
      const sel = picked();
      this.close();
      exportHighlightsToBookNote(this.app, this.plugin, this.bookFile, sel);
    });
    toSep.addEventListener("click", () => {
      const sel = picked();
      this.close();
      exportHighlightsSeparate(this.app, this.plugin, this.bookFile, sel);
    });
    refresh();
  }
  onClose() {
    this.contentEl.empty();
  }
};
async function exportHighlightsMenu(app, plugin, bookFile, highlights, evt) {
  if (!highlights || !highlights.length) {
    new Notice(__ertr("Нет выделений для экспорта"));
    return;
  }
  const name = bookFile ? bookNoteLinkFor(plugin, bookFile) : "";
  const noteFile = name ? resolveBookNote(app, name) : null;
  let noteText = "";
  if (noteFile) {
    try {
      noteText = await app.vault.cachedRead(noteFile);
    } catch {
      noteText = "";
    }
  }
  new HighlightExportModal(app, plugin, bookFile, highlights, noteText, noteFile ? noteFile.basename : "").open();
}
const InfoModal = class extends Modal {
  constructor(app, plugin, file) {
    super(app);
    this.plugin = plugin || null;
    this.file = file || null;
  }
  onOpen() {
    const { contentEl, modalEl } = this;
    modalEl.addClass("er-info-modal");
    contentEl.empty();
    contentEl.createDiv("er-info-title").setText(`Qiaomu Book Reader · ${__ertr("Инструкция по плагину")}`);
    contentEl.createDiv("er-info-sub").setText(__ertr("Что делает каждая кнопка и зачем"));
    const groups = [
      { head: __ertr("Верхняя панель"), rows: [
        ["note", __ertr("Заметка книги"), __ertr("Открывает заметку этой книги рядом с текстом. Если заметки ещё нет, создаёт её автоматически.")],
        ["search", __ertr("Поиск"), __ertr("Поиск по всему тексту книги — список совпадений с фрагментом вокруг каждого, клик переходит к месту.")],
        ["highlighter", __ertr("Выделения"), __ertr("Открывает список всех ваших выделений в этой книге. Клик по строке — переход к этому месту. У каждого выделения есть значок комментария — короткая мысль, которая остаётся при цитате. Сверху списка — кнопка экспорта в заметки.")],
        ["list", __ertr("Содержание"), __ertr("Оглавление книги: закладки PDF, заголовки, печатное содержание или жирные абзацы — что нашлось первым. У каждого пункта — номер страницы и текущий разворот. Много пунктов — сверху появится фильтр.")],
        ["sliders", __ertr("Настройки"), __ertr("Тема, шрифт, размер текста, число колонок и блок \xABВернуться к месту\xBB — список точек, к которым можно откатиться.")],
        ["info", __ertr("Справка"), __ertr("Это окно.")]
      ] },
      { head: __ertr("Чтение и навигация"), rows: [
        ["chevron-left", __ertr("Листать страницы"), __ertr("Стрелки внизу экрана, клавиши ← → ↑ ↓ и пробел, либо свайп пальцем на телефоне. Каждое перелистывание автоматически сохраняет позицию — отдельно жать \xABСохранить\xBB не обязательно.")]
      ] },
      { head: __ertr("Выделения и заметки"), rows: [
        ["highlighter", __ertr("Выделить текст"), __ertr("Выделите фрагмент мышью или пальцем — всплывёт палитра цветов. Клик по уже готовому выделению — сменить цвет или удалить его.")],
        ["note", __ertr("Создать заметку из выделения"), __ertr("Правый клик по выделенному тексту → \xABСоздать новую заметку\xBB. Заметка создаётся по вашему шаблону в выбранной папке, с цитатой и ссылкой на книгу.")],
        ["download", __ertr("Перенести выделения в заметки"), __ertr("Кнопка вверху панели \xABВыделения\xBB. Откроется список, где можно отметить нужные фрагменты — по одному, \xABВыделить все\xBB или \xABТолько новые\xBB. То, что уже перенесено в заметку книги, помечено и снято с отметки, поэтому повторный экспорт ничего не задваивает. Дальше на выбор: вставить текстом в заметку книги или создать отдельную заметку на каждый фрагмент.")]
      ] }
    ];
    groups.forEach((g) => {
      contentEl.createDiv("er-info-group").setText(g.head);
      g.rows.forEach(([ic, title, desc]) => {
        const row = contentEl.createDiv("er-info-row");
        const ig = row.createDiv("er-info-ic");
        svgIcon(ig, ic);
        const tx = row.createDiv("er-info-tx");
        tx.createDiv("er-info-rowtitle").setText(title);
        tx.createDiv("er-info-rowdesc").setText(desc);
      });
    });
    const note = contentEl.createDiv("er-info-note");
    note.createDiv("er-info-rowtitle").setText(__ertr("Про автосохранение"));
    note.createDiv("er-info-rowdesc").setText(__ertr("Позиция сохраняется сама при каждом перелистывании и хранится в общем файле, который синхронизируется между устройствами (Obsidian Sync). Перестроение страницы (смена размера окна, панелей, масштаба) больше НЕ двигает и не пересохраняет прогресс — поэтому он не \xABуезжает\xBB сам по себе."));
  }
  onClose() {
    let _a, _b;
    (_b = (_a = this._pdfLazy) == null ? void 0 : _a.destroy) == null ? void 0 : _b.call(_a);
    this._pdfLazy = null;
    this.contentEl.empty();
  }
};
const ONBOARD_SLIDES = [
  {
    emoji: "\u{1F4D6}",
    title: "Qiaomu Book Reader",
    body: [
      __ertr("Это уютная читалка книг прямо внутри Obsidian. Читаете, выделяете важное и превращаете выделения в заметки — не выходя из хранилища."),
      __ertr("Пролистайте несколько экранов стрелкой → (или кнопкой \xABДалее\xBB). Это займёт минуту, зато потом всё будет понятно.")
    ]
  },
  {
    emoji: "\u{1F4DA}",
    title: __ertr("Какие форматы и как открыть книгу"),
    body: [
      __ertr("Читалка открывает три формата: EPUB (.epub), FB2 (.fb2) и PDF (.pdf)."),
      __ertr("Чтобы читать книгу, положите её файл в своё хранилище Obsidian и просто кликните по нему — она откроется в читалке."),
      __ertr("На левой панели есть значок \u{1F4D6} \xABБиблиотека\xBB — там все ваши книги с обложками в одном месте.")
    ]
  },
  {
    emoji: "\u{1F423}",
    title: __ertr("Это самая первая версия"),
    tone: "warn",
    body: [
      __ertr("Пожалуйста, не загружайте сразу много книг. Начните с двух-трёх и проверьте, что всё работает стабильно именно на вашем устройстве."),
      __ertr("Особенно аккуратно с очень большими PDF (сотни страниц или сканы картинок) — они тяжёлые и могут подтормаживать."),
      __ertr("Плагин будет становиться лучше. А пока — по чуть-чуть и бережно \u{1F642}")
    ]
  },
  {
    emoji: "\u{1F58D}️",
    title: __ertr("Выделения: цвета и действия"),
    body: [
      __ertr("Выделите текст пальцем или мышью — появится палитра. Выберите цвет, и выделение сохранится."),
      __ertr("Нажмите на уже готовое выделение — откроется то же меню: сменить цвет, скопировать, поставить закладку \xABостановился здесь\xBB, создать заметку, отправить в заметку книги или удалить."),
      __ertr("Все выделения книги собраны в панели \u{1F58D}️ наверху — оттуда можно перейти к любому или экспортировать все сразу.")
    ]
  },
  {
    emoji: "\u{1F517}",
    title: __ertr("Что такое \xABзаметка книги\xBB"),
    body: [
      __ertr("У каждой книги можно завести одну обычную заметку Obsidian — её \xABглавную страницу\xBB, например \xABМастер и Маргарита.md\xBB."),
      __ertr("Когда вы создаёте заметку из выделения, в ней ставится ссылка на эту заметку книги. А ещё цитаты можно отправлять прямо в неё — так все мысли по книге собираются в одном месте."),
      __ertr("Это не обязательно настраивать прямо сейчас — привязать заметку книги можно в любой момент позже. Откройте книгу, нажмите значок ⓘ (справка) вверху читалки и заполните поле \xABЗаметка книги для ссылок\xBB. Пока ничего не привязано, ссылки просто ведут на имя файла книги.")
    ]
  },
  {
    emoji: "\u{1F4BE}",
    title: __ertr("Где всё хранится"),
    body: [
      __ertr("Ваш прогресс чтения и выделения хранятся файлами прямо в хранилище (рядом с книгами или в отдельной папке — это настраивается). Ничего не спрятано \xABвнутри плагина\xBB — всё лежит у вас."),
      __ertr("Заметки из выделений и заметки книги — это самые обычные .md заметки в вашей папке. Открывайте, редактируйте и связывайте их, как любые другие.")
    ]
  },
  {
    emoji: "\u{1F504}",
    title: __ertr("Про синхронизацию"),
    tone: "warn",
    body: [
      __ertr("Раз прогресс и выделения — это файлы в хранилище, они синхронизируются вместе с ним (Obsidian Sync, iCloud и т.п.)."),
      __ertr("Дайте синхронизации закончиться, прежде чем открывать ту же книгу на другом устройстве, и не читайте одну книгу на двух устройствах сразу — иначе позиция может \xABпоспорить сама с собой\xBB."),
      __ertr("На разных устройствах путь к папке с книгами бывает разным — проверьте папки в настройках плагина.")
    ]
  },
  {
    emoji: "\u{1F9ED}",
    title: __ertr("Пример: как это всё работает"),
    body: [
      __ertr("1. Кладёте файл книги (.epub, .fb2 или .pdf) в хранилище и открываете его кликом."),
      __ertr("2. Читаете. Позиция сохраняется сама при каждом перелистывании — ничего нажимать не нужно."),
      __ertr("3. Понравилась мысль — выделяете её и выбираете цвет. Выделение сохранилось."),
      __ertr("4. (по желанию) Нажимаете ⓘ вверху и привязываете \xABзаметку книги\xBB — свою страницу для этой книги. Это можно сделать и потом."),
      __ertr("5. Нажимаете на выделение → \xABв заметку книги\xBB — цитата улетает в эту страницу, и плагин предложит открыть её. Готово: все ваши цитаты в одном месте.")
    ]
  },
  // ── Walk-through of the settings, one screen per thing to decide ──────────
  // Written as "what it does → what to pick → what happens if you don't touch
  // it", because the usual complaint after installing is not knowing which of
  // these matter and which can be ignored.
  {
    emoji: "⚙️",
    title: __ertr("Дальше — разбор настроек"),
    body: [
      __ertr("Следующие экраны проходят по настройкам плагина: что делает каждая, что выбрать и что будет, если ничего не менять."),
      __ertr("Открыть настройки: шестерёнка Obsidian → \xABПлагины сообщества\xBB → Qiaomu Book Reader. Вверху шесть вкладок: Чтение, Оформление, Заметки, Перевод, Данные, О плагине."),
      __ertr("Ни одну из них не обязательно настраивать сразу — плагин работает и так. Этот разбор нужен, чтобы вы знали, что вообще можно поменять.")
    ]
  },
  {
    emoji: "\u{1F4CA}",
    title: __ertr("Вкладка \xABЧтение\xBB: статистика"),
    body: [
      __ertr("Вверху вкладки — карточка со статистикой: сколько прочитано за всё время, серия дней подряд, среднее за день, лучший день и график за две недели."),
      __ertr("Она заполняется сама, когда вы читаете с включённым таймером ▶ (кнопка вверху читалки). Настраивать нечего — просто смотрите."),
      __ertr("Пример: \xAB12 ч 30 мин за всё время \xB7 \u{1F525} 5 дн. подряд\xBB. Если таймер не включать, время не считается.")
    ]
  },
  {
    emoji: "\u{1F446}",
    title: __ertr("Настройка \xABЛистание страниц\xBB"),
    body: [
      __ertr("\xABКнопками\xBB — листаете стрелками внизу, клавишами ← → ↑ ↓ и пробелом, на телефоне свайпом. Центр страницы свободен: выделять текст удобно."),
      __ertr("\xABПо клику мышкой\xBB — клик по левой половине страницы листает назад, по правой вперёд. Быстрее, но случайный клик может перелистнуть, когда вы хотели выделить фразу."),
      __ertr("Что выбрать: начните с \xABКнопками\xBB. Переключите на \xABПо клику\xBB, если читаете подряд и мало выделяете.")
    ]
  },
  {
    emoji: "\u{1F4D0}",
    title: __ertr("\xABВыравнивание\xBB и \xABПоложение текста\xBB"),
    body: [
      __ertr("Выравнивание — как текст прижат в колонке: слева (рваный правый край, как в браузере), по ширине (ровные оба края, как в бумажной книге), по центру или справа."),
      __ertr("Положение на странице — что делать, если страница заполнена не до конца, например в конце главы: оставить текст сверху, поставить по центру или прижать вниз."),
      __ertr("Что выбрать: \xABПо ширине\xBB + \xABСверху\xBB — самый привычный книжный вид. \xABПо центру\xBB имеет смысл, только если вас раздражают полупустые страницы в конце глав.")
    ]
  },
  {
    emoji: "\u{1F576}️",
    title: __ertr("\xABПогружение\xBB и цель чтения"),
    body: [
      __ertr("Погружение: панели сверху и снизу мягко притухают через пару секунд без движения мыши и возвращаются при первом движении. Ничто не отвлекает от текста."),
      __ertr("Цель на день: ползунок от 5 до 120 минут. Таймер ▶ вверху читалки запускается ВРУЧНУЮ и считает обратный отсчёт до цели, ⏸ ставит на паузу."),
      __ertr("Важно: таймер не запускается сам. Если забыть нажать ▶, время чтения и статистика не наберутся.")
    ]
  },
  {
    emoji: "\u{1F4DD}",
    title: __ertr("Заметка из выделения: название, папка, теги"),
    body: [
      __ertr("Выделили фрагмент → \xABСоздать заметку\xBB. Откроется окно с тремя полями: название (подставляется короткое, можно поправить или одной кнопкой взять фрагмент целиком), папка и теги."),
      __ertr("Папка выбирается из подсказки, теги — через запятую, с подсказкой из уже используемых в хранилище. И то и другое запоминается для следующей заметки, так что вводить каждый раз не нужно."),
      __ertr("Пример: выделили абзац про PEP 8 → название \xABСтиль кода PEP 8\xBB, папка \xAB0. Files/5. Inbox\xBB, теги \xABpython, стиль\xBB. Окно можно отключить в настройках → Заметки.")
    ]
  },
  {
    emoji: "\u{1F50B}",
    title: __ertr("Режим для e-ink читалок"),
    body: [
      __ertr("Если Obsidian стоит на Android-читалке с электронными чернилами, включите \xABРежим для e-ink\xBB в настройках → Чтение."),
      __ertr("Он убирает всё, что на таком экране оставляет следы: анимации, плавные переходы, тени, размытие и полупрозрачность. Цвета — чистый чёрный на белом, рамки жёсткие, кнопки крупнее под палец."),
      __ertr("Отдельно в списке тем появляется \xABE-ink\xBB — максимальный контраст без оттенков.")
    ]
  },
  {
    emoji: "\u{1F4C2}",
    title: __ertr("Куда складывать заметки"),
    body: [
      __ertr("\xABПапка для новых заметок\xBB — куда попадают заметки, созданные из выделений. Пусто — в корень хранилища. Пример: 0. Files/5. Inbox"),
      __ertr("\xABПапка заметок-книг\xBB — откуда берётся список, когда вы выбираете заметку книги. Пусто — можно выбрать любую заметку хранилища. Пример: 3. Resources/База книг"),
      __ertr("Путь пишется от корня хранилища, через косую черту. Папку можно выбрать из подсказки — начните печатать, и появится список.")
    ]
  },
  {
    emoji: "\u{1F517}",
    title: __ertr("Заметка книги и шаблон"),
    body: [
      __ertr("У каждой книги может быть своя заметка — в неё складываются цитаты и на неё ведут ссылки \xAB— из [[…]]\xBB из всех заметок по этой книге."),
      __ertr("\xABСвоя заметка на каждую книгу\xBB — создавать её автоматически при первом открытии, не спрашивая. Иначе плагин спросит один раз сам."),
      __ertr("\xABШаблон заметки\xBB — файл, по которому создаются заметки из выделений. Работает и с Templater, если он у вас стоит. Пусто — заметка будет просто с цитатой и ссылкой.")
    ]
  },
  {
    emoji: "\u{1F30D}",
    title: __ertr("Вкладка \xABПеревод\xBB"),
    body: [
      __ertr("Выключено по умолчанию. Если включить, у выделенного текста появится кнопка перевода — удобно для книг на английском."),
      __ertr("Это единственное место, где плагин выходит в интернет: выделенный фрагмент уходит в бесплатный переводчик Google. Больше никуда и ничего не отправляется."),
      __ertr("Язык перевода выбирается там же. Перевод можно сохранить в заметку под оригиналом.")
    ]
  },
  {
    emoji: "\u{1F5C4}️",
    title: __ertr("Вкладка \xABДанные\xBB: где что лежит"),
    body: [
      __ertr("\xABПапка с книгами\xBB — где плагин ищет книги для библиотеки. Пусто — ищет по всему хранилищу."),
      __ertr("\xABПапка для данных\xBB — где лежат файлы прогресса и выделений. Пусто — рядом с книгами. Эти файлы синхронизируются между устройствами, поэтому чтение продолжается с того же места на телефоне."),
      __ertr("\xABПамять о книгах\xBB — кнопка \xABЗабыть все книги\xBB сбрасывает привязки заметок и категорий, но сами заметки не удаляет. Нужна, если хотите настроить всё заново.")
    ]
  },
  {
    emoji: "\u{1F58D}️",
    title: __ertr("Как перенести выделения в заметки"),
    body: [
      __ertr("Кнопка экспорта вверху панели \xABВыделения\xBB открывает список всех выделений книги с галочками."),
      __ertr("Можно отметить нужные по одному, нажать \xABВыделить все\xBB или \xABТолько новые\xBB. То, что уже перенесено в заметку книги, помечено и снято с отметки — повторный экспорт ничего не задваивает."),
      __ertr("Дальше на выбор: вставить текстом в заметку книги (всё в одном месте) или создать отдельную заметку на каждый фрагмент (для связей между заметками)."),
      __ertr("В заметке цитаты собраны по главам, у каждой — номер страницы книги, а комментарий (если вы его оставили) идёт прямо под цитатой.")
    ]
  },
  {
    emoji: "\u{1F4AC}",
    title: __ertr("Комментарий к выделению"),
    body: [
      __ertr("У выделенного текста, кроме \xABСоздать заметку\xBB, есть значок комментария — короткая мысль, которая остаётся ПРИ выделении, а не улетает в отдельный файл."),
      __ertr("Пример: подчеркнули спорный тезис и приписали \xABа вот тут он сам себе противоречит\xBB — эта строка видна в панели \xABВыделения\xBB под цитатой и попадает в заметку книги при экспорте."),
      __ertr("Сохраняется по кнопке или Ctrl+Enter. Если очистить поле — комментарий удаляется, сама цитата остаётся.")
    ]
  },
  {
    emoji: "\u{1F50E}",
    title: __ertr("Поиск по книге"),
    body: [
      __ertr("Значок лупы вверху читалки (или команда \xABПоиск по книге\xBB) открывает поиск по всему тексту — со списком совпадений и фрагментом текста вокруг каждого."),
      __ertr("Клик по результату — переход прямо к этому месту, на любом устройстве и при любой ширине окна."),
      __ertr("Найденное слово подсвечивается жёлтым прямо в тексте книги, поэтому искать его глазами в абзаце не нужно. Через несколько секунд подсветка гаснет сама, чтобы не мешать чтению; убрать сразу — \xABСнять подсветку\xBB в панели поиска."),
      __ertr("Ищет по части слова: запрос \xABсистем\xBB найдёт и \xABсистема\xBB, и \xABсистемы\xBB, и \xABсистемный\xBB.")
    ]
  },
  {
    emoji: "\u{1F4D1}",
    title: __ertr("Оглавление: откуда оно берётся"),
    body: [
      __ertr("Плагин ищет оглавление в таком порядке: сначала настоящие закладки из PDF, потом заголовки в тексте, потом печатное содержание книги (та страница со списком глав и точками), и в последнюю очередь — жирные абзацы, если больше зацепиться не за что."),
      __ertr("У каждого пункта — номер страницы книги и номер текущего разворота, который пересчитывается на лету: он меняется при изменении ширины окна или открытии боковых панелей, поэтому его нельзя один раз сохранить."),
      __ertr("Если пунктов много (в технических книгах бывает 300–400), сверху появляется поле фильтра — начните печатать название главы.")
    ]
  },
  {
    emoji: "\u{1F5BC}️",
    title: __ertr("Картинки в книгах"),
    body: [
      __ertr("Иллюстрации из PDF показываются прямо в тексте. Страницы-сканы рисуются целиком, а на обычных страницах вырезается сама картинка, а не скриншот всей страницы."),
      __ertr("Грузятся они по мере чтения и выгружаются, когда далеко — поэтому книга на 500 страниц с иллюстрациями не съедает память."),
      __ertr("Если картинки мешают и нужен только текст, их можно выключить: настройки → Чтение → \xABПоказывать картинки из книги\xBB.")
    ]
  },
  {
    emoji: "⌨️",
    title: __ertr("Команды и горячие клавиши"),
    body: [
      __ertr("В палитре команд (Ctrl+P) есть \xABОткрыть книгу: …\xBB на каждую вашу книгу — можно повесить горячую клавишу и открывать нужную книгу одним нажатием."),
      __ertr("Ещё есть \xABПродолжить чтение\xBB — открывает последнюю книгу с того места, где вы остановились, и \xABОткрыть книгу…\xBB — список с поиском."),
      __ertr("Горячая клавиша назначается в настройках Obsidian → \xABГорячие клавиши\xBB, поиск по слову Reader.")
    ]
  },
  {
    emoji: "💬",
    title: __ertr("Пожелания и ошибки"),
    body: [
      __ertr("Сообщите об ошибке или предложите функцию — мы ответим в GitHub."),
      __ertr("Откройте настройки плагина → «О плагине» → GitHub Issues."),
      __ertr("Каждое сообщение помогает определить, что улучшать дальше.")
    ]
  },
  {
    emoji: "✅",
    title: __ertr("Готово — приятного чтения!"),
    body: [
      __ertr("Что настроить по желанию (не обязательно сразу): папку для книг и папку для заметок — в настройках плагина. Заметку книги — под значком ⓘ прямо во время чтения."),
      __ertr("Что можно вообще не трогать: прогресс и выделения работают сразу и сохраняются сами."),
      __ertr("Полная справка по каждой кнопке — значок ⓘ в читалке. Этот экран приветствия можно снова открыть в настройках плагина."),
      __ertr("Нажмите \xABНачать читать\xBB и откройте свою первую книгу \u{1F4D6}")
    ]
  }
];
function bookNoteAction(settings, bookPath) {
  const s = settings || {};
  const links = s.bookNoteLinks || {};
  const asked = s.bookNotePrompted || {};
  if (!bookPath) return "prompted";
  if (links[bookPath]) return "linked";
  if (s.autoBookNote) return asked[bookPath] ? "prompted" : "auto";
  return asked[bookPath] ? "prompted" : "ask";
}
const WHATS_NEW = [
  { v: "3.2.2", items: [
    __ertr("修复旧阅读笔记的重复书名标题迁移")
  ] },
  { v: "3.2.1", items: [
    __ertr("简体中文现在是新安装和旧版升级后的默认界面语言"),
    __ertr("阅读进度全自动保存，不再显示多余的恢复点与重绘按钮"),
    __ertr("阅读器新增阅读笔记按钮：没有就创建，已有就在原书旁分屏打开"),
    __ertr("自动创建的阅读笔记不再重复显示书名一级标题")
  ] },
  { v: "3.2.0", items: [
    __ertr("Новый китайский интерфейс и шрифты Source Han Serif / Source Han Sans"),
    __ertr("Ссылки из заметок обратно в книгу теперь показаны одной иконкой, без лишнего текста"),
    __ertr("Библиотека получила спокойную редакционную компоновку без эмодзи, бликов и тяжёлых карточек"),
    __ertr("Плагин теперь называется Qiaomu Book Reader и поддерживается 向阳乔木; оригинальный Elton Reader указан в благодарностях")
  ] },
  { v: "3.1.0", items: [
    __ertr("Плагин снова открывается там, где раньше писал «Не удалось загрузить»: на Obsidian постарше, на планшетах Huawei и на части Windows-сборок"),
    __ertr("Цитаты можно складывать в одну заметку книги: в окне названия появилась кнопка «В заметку книги», а в меню выделения — «Текстом в заметку книги»"),
    __ertr("Подпись ссылки «↪ к месту в книге» теперь своя — задаётся в настройках"),
    __ertr("Клик по выделению в списке ведёт к месту в книге даже там, где страница ещё не отрисована"),
    __ertr("Панель выделения больше не убегает на пустое место в начале абзаца и на границе страниц"),
    __ertr("Верхняя панель на Android больше не заезжает под часы; если оболочка телефона молчит о высоте шторки, отступ можно задать руками"),
    __ertr("Что нового теперь сохраняется заметкой в хранилище — не нужно запоминать окно")
  ] },
  { v: "3.0.2", items: [
    __ertr("Пожелания и ошибки теперь собираются в телеграм-боте @book_in_obsidian_bot — просто напишите ему сообщение"),
    __ertr("Разбор фрагмента стал диалогом: свой вопрос, свой системный промпт, название книги уходит фоном"),
    __ertr("Читалка подстраивается под устройство: у телефона, планшета и компьютера своя раскладка"),
    __ertr("Тема читалки и библиотеки меняется мгновенно, появилась подстройка под тему Obsidian"),
    __ertr("Движок PDF обновлён — открытие книг стало надёжнее")
  ] },
  { v: "2.0.1", items: [
    __ertr("Абзацы в PDF сохраняются как в оригинале — текст больше не склеивается в сплошную стену"),
    __ertr("Библиотека: кнопка \xABДобавить книгу\xBB и перетаскивание файлов (PDF, EPUB, FB2) прямо в окно"),
    __ertr("PDF-движок встроен в плагин — книги открываются офлайн, ничего не подгружается из интернета"),
    __ertr("В списке выделений комментарий больше не ломает цитату — он аккуратно встаёт под ней")
  ] },
  { v: "2.0.0", items: [
    __ertr("Поиск по всей книге — значок лупы вверху читалки, со списком совпадений и переходом к месту"),
    __ertr("Найденное слово подсвечивается прямо в тексте, чтобы не искать его глазами в абзаце"),
    __ertr("Комментарий к выделению — короткая мысль остаётся при цитате, а не улетает в отдельный файл"),
    __ertr("Оглавление наконец работает — брало данные, но не показывало их; починил, добавил номер страницы, живой номер разворота и фильтр для длинных списков"),
    __ertr("Экспорт цитат группирует их по главам и подписывает номер страницы"),
    __ertr("Картинки из книг теперь показываются сразу — раньше их приходилось искать в другой читалке"),
    __ertr("Заметку из выделения можно сразу положить в нужную папку и проставить теги"),
    __ertr("Выделения переносятся выборочно: галочки, \xABвыделить все\xBB, \xABтолько новые\xBB — уже перенесённое не задваивается"),
    __ertr("Режим для e-ink читалок: без анимаций и теней, чистый чёрный на белом, крупнее кнопки"),
    __ertr("Инструкция выросла до 21 экрана — теперь разбирает каждую настройку с примерами"),
    __ertr("Книгу можно открыть командой — своя команда и горячая клавиша на каждую книгу"),
    __ertr("Статистика чтения: сколько всего прочитано, серия дней и график за две недели"),
    __ertr("Листание строго вправо, без съезжания в угол, и текст стал чётким"),
    __ertr("Строки заполняют страницу до конца — больше нет пустых мест внизу колонки"),
    __ertr("Перестроение при сворачивании панелей стало плавным, а не рывком"),
    __ertr("Новый формат: FB2 (в том числе старые файлы в кодировке windows-1251)"),
    __ertr("Технические книги читаются нормально: код, таблицы и формулы больше не разваливаются"),
    __ertr("Листинги распознаются даже там, где в книге не указан шрифт кода"),
    __ertr("Пояснения на полях больше не вклеиваются в строки кода"),
    __ertr("Страницы оглавления с точками отображаются как аккуратный список"),
    __ertr("Короткую страницу можно центрировать по вертикали, а не прижимать к верху"),
    __ertr("Оглавление берётся из самого PDF, а на компьютере оно наконец работает"),
    __ertr("Из PDF показываются сами иллюстрации, а не скриншот всей страницы"),
    __ertr("Перевод выделенного фрагмента — включается в настройках"),
    __ertr("Библиотека: категории по жанрам и папкам, фильтр \xABчитаю / прочитано\xBB"),
    __ertr("При первом открытии книги можно СОЗДАТЬ для неё заметку, а не только выбрать"),
    __ertr("Настройки разложены по вкладкам, редкое убрано в \xABДоп. настройки\xBB"),
    __ertr("Текст сам перевёрстывается при открытии панелей и не теряет место"),
    __ertr("Исправлено: ввод пути в настройках создавал папку на каждый символ"),
    __ertr("Плагин стал легче почти на 4 МБ")
  ] }
];
function cmpVer(a, b) {
  const pa = String(a || "0").split(".").map((n) => parseInt(n, 10) || 0);
  const pb = String(b || "0").split(".").map((n) => parseInt(n, 10) || 0);
  for (let i = 0; i < Math.max(pa.length, pb.length); i++) {
    const x = pa[i] || 0, y = pb[i] || 0;
    if (x !== y) return x > y ? 1 : -1;
  }
  return 0;
}
function whatsNewSince(lastSeen, current, log) {
  return (log || WHATS_NEW).filter((r) => cmpVer(r.v, lastSeen) > 0 && cmpVer(r.v, current) <= 0);
}
// Список изменений остаётся в хранилище заметкой.
//
// Окно «Что нового» показывается один раз и закрывается — а вопросы «что вообще
// поменялось в этом обновлении» приходят через неделю. Заметка лежит там же, где
// остальные заметки читалки, ищется поиском и переживает любое окно. Уже
// существующую не трогаем: человек мог её дописать.
async function writeWhatsNewNote(app, plugin, releases) {
  try {
    if (!releases || !releases.length) return null;
    const title = sanitizeNoteTitle(`Qiaomu Book Reader ${plugin.manifest.version} — ${__ertr("Что нового")}`);
    const path = inboxNotePath(app, title, null);
    const exist = app.vault.getAbstractFileByPath(path);
    if (exist instanceof TFile) return exist;
    const body = releases.map((r) => `## ${r.v}

${r.items.map((i) => `- ${__ertr(i)}`).join("\n")}`).join("\n\n");
    await resolveNotesFolder(app, null);
    const f = await app.vault.create(path, `${__ertr("Книжная читалка обновилась до версии {0}. Что изменилось:", plugin.manifest.version)}

${body}
`);
    return f instanceof TFile ? f : null;
  } catch (e) {
    console.warn("Book Reader: could not write the what's-new note", e);
    return null;
  }
}
const WhatsNewModal = class extends Modal {
  constructor(app, plugin, releases, noteFile) {
    super(app);
    this.plugin = plugin;
    this.releases = releases;
    this.noteFile = noteFile || null;
  }
  onOpen() {
    const c = this.contentEl;
    this.modalEl.addClass("er-onb-modal");
    c.empty();
    const card = c.createDiv("er-onb-card er-wn-card");
    card.createDiv("er-onb-emoji").setText("✨");
    card.createDiv("er-onb-title").setText(__ertr("Что нового"));
    card.createDiv("er-wn-sub").setText(`Qiaomu Book Reader · ${this.plugin.manifest.version}`);
    const wrap = card.createDiv("er-wn-wrap");
    for (const r of this.releases) {
      const grp = wrap.createDiv("er-wn-rel");
      grp.createDiv("er-wn-ver").setText(r.v);
      const ul = grp.createDiv("er-wn-list");
      for (const it of r.items) {
        const row = ul.createDiv("er-wn-item");
        row.createSpan({ cls: "er-wn-dot", text: "✦" });
        row.createSpan({ text: __ertr(it) });
      }
    }
    const nav = c.createDiv("er-onb-nav er-wn-nav");
    const ok = nav.createEl("button", { text: __ertr("Понятно") });
    ok.addClass("er-onb-start", "er-wn-ok");
    ok.addEventListener("click", () => this.close());
    if (this.noteFile) {
      const open = c.createDiv("er-onb-skip");
      open.setText(__ertr("Список сохранён заметкой «{0}» — открыть", this.noteFile.basename));
      open.addEventListener("click", () => {
        this.close();
        this.app.workspace.getLeaf(true).openFile(this.noteFile);
      });
    }
    const help = c.createDiv("er-onb-skip");
    help.setText(__ertr("Инструкция: разбор всех настроек по шагам"));
    help.addEventListener("click", () => {
      this.close();
      new OnboardingModal(this.app, this.plugin).open();
    });
  }
  onClose() {
    this.contentEl.empty();
  }
};
const BookSetupModal = class extends Modal {
  constructor(app, plugin, file, onDone) {
    super(app);
    this.plugin = plugin;
    this.file = file;
    this.onDone = onDone || (() => {
    });
    this._answered = false;
    this._step = 1;
  }
  onOpen() {
    this.modalEl.addClass("er-setup-modal");
    this._render();
  }
  _render() {
    this.contentEl.empty();
    if (this._step === 1) this._renderPick();
    else this._renderCreate();
  }
  // ── Step 1: link an existing note ─────────────────────────────────────────
  // One job per screen: here you only choose. Everything about MAKING a note
  // lives on step 2, so this screen stays a short list instead of a form.
  _renderPick() {
    const c = this.contentEl;
    c.createDiv("er-info-title").setText(__ertr("Заметка для книги"));
    c.createDiv("er-info-sub").setText(this.file.basename);
    c.createDiv("er-setup-lead").setText(__ertr("Цитаты и мысли из книги будут ссылаться на эту заметку."));
    const search = c.createEl("input", { type: "text" });
    search.addClass("er-setup-input");
    search.placeholder = __ertr("Поиск заметки…");
    const listEl = c.createDiv("er-setup-list");
    const all = bookNoteFiles(this.app);
    const paint = (q) => {
      listEl.empty();
      const needle = (q || "").trim().toLowerCase();
      const shown = (needle ? all.filter((f) => f.basename.toLowerCase().includes(needle)) : all).slice(0, 200);
      if (!all.length) {
        listEl.createDiv("er-setup-empty").setText(__ertr("В хранилище пока нет заметок — создайте новую ниже"));
        return;
      }
      if (!shown.length) {
        listEl.createDiv("er-setup-empty").setText(__ertr("Ничего не найдено"));
        return;
      }
      for (const f of shown) {
        const row = listEl.createDiv("er-setup-row");
        row.createDiv("er-setup-row-name").setText(f.basename);
        const dir = f.parent && f.parent.path && f.parent.path !== "/" ? f.parent.path : "";
        if (dir) row.createDiv("er-setup-row-path").setText(dir);
        row.addEventListener("click", async () => {
          this.plugin.settings.bookNoteLinks[this.file.path] = f.basename;
          await this.plugin.saveAll();
          await writeBookProperty(this.app, f.basename, this.file);
          this._finish(__ertr("Заметка книги: {0}", f.basename));
        });
      }
    };
    search.addEventListener("input", () => paint(search.value));
    paint("");
    const foot = c.createDiv("er-setup-foot");
    const mk = foot.createEl("button", { text: __ertr("Создать заметку…") });
    mk.addClass("er-setup-btn", "er-setup-btn-primary");
    mk.addEventListener("click", () => {
      this._step = 2;
      this._render();
    });
    const skip = foot.createEl("button", { text: __ertr("Читать без заметки") });
    skip.addClass("er-setup-btn", "er-setup-btn-quiet");
    skip.addEventListener("click", () => this._finish(""));
    erAutoFocus(search, 30);
    erBlurOnTapOutside(this.contentEl, search);
  }
  // ── Step 2: create a new note ─────────────────────────────────────────────
  _renderCreate() {
    const c = this.contentEl;
    const back = c.createDiv("er-setup-back");
    back.setText(__ertr("← Назад"));
    back.addEventListener("click", () => {
      this._step = 1;
      this._render();
    });
    c.createDiv("er-info-title").setText(__ertr("Создать заметку"));
    c.createDiv("er-info-sub").setText(this.file.basename);
    const field = (label, value, placeholder) => {
      const w = c.createDiv("er-setup-field");
      w.createDiv("er-setup-label").setText(label);
      const el = w.createEl("input", { type: "text" });
      el.addClass("er-setup-input");
      if (value) el.value = value;
      if (placeholder) el.placeholder = placeholder;
      return el;
    };
    const nameInput = field(__ertr("Название заметки"), sanitizeNoteTitle(this.file.basename));
    const folderInput = field(__ertr("Папка"), bookNotesFolderPath(this.app) || notesFolderPath(this.app) || "", __ertr("Корень хранилища"));
    try {
      if (FolderSuggest) new FolderSuggest(this.app, folderInput);
    } catch { /* optional step; a failure here must not interrupt reading */ }
    const tagsInput = field(__ertr("Категория"), bookTagsOf(this.plugin.settings, this.file.path).join(", "), __ertr("Например: Психология, Бизнес"));
    const known = allBookTags(this.plugin.settings);
    if (known.length) {
      const dl = c.createEl("datalist");
      dl.id = "er-setup-tags-" + Math.random().toString(36).slice(2, 8);
      known.forEach((t) => dl.createEl("option", { value: t }));
      tagsInput.setAttr("list", dl.id);
    }
    c.createDiv("er-setup-hint").setText(__ertr("Жанр или тема — по ней книги группируются в библиотеке. Несколько — через запятую. Можно оставить пустым."));
    const foot = c.createDiv("er-setup-foot");
    const createBtn = foot.createEl("button", { text: __ertr("Создать и начать читать") });
    createBtn.addClass("er-setup-btn", "er-setup-btn-primary");
    createBtn.addEventListener("click", async () => {
      createBtn.disabled = true;
      const note = await this.plugin.createBookNote(this.file, nameInput.value, folderInput.value);
      if (!note) {
        createBtn.disabled = false;
        return;
      }
      await this.plugin.setBookTags(this.file.path, parseBookTags(tagsInput.value));
      this._finish(__ertr("Заметка книги создана: {0}", note.basename));
    });
    [nameInput, folderInput, tagsInput].forEach((el) => el.addEventListener("keydown", (e) => {
      if (e.key === "Enter") {
        e.preventDefault();
        createBtn.click();
      }
    }));
    erAutoFocus(nameInput, 30);
    erBlurOnTapOutside(this.contentEl, nameInput);
  }
  async _finish(msg) {
    this._answered = true;
    const s = this.plugin.settings;
    if (!s.bookNotePrompted) s.bookNotePrompted = {};
    s.bookNotePrompted[this.file.path] = true;
    await this.plugin.saveAll();
    if (msg) new Notice(msg);
    this.close();
    this.onDone();
  }
  onClose() {
    this.contentEl.empty();
    if (!this._answered) this.onDone();
  }
};
const OnboardingModal = class extends Modal {
  constructor(app, plugin) {
    super(app);
    this.plugin = plugin || null;
    this.idx = 0;
    this._finished = false;
  }
  onOpen() {
    this.modalEl.addClass("er-onb-modal");
    this.scope.register([], "ArrowRight", (e) => {
      e.preventDefault();
      this._go(1);
    });
    this.scope.register([], "ArrowLeft", (e) => {
      e.preventDefault();
      this._go(-1);
    });
    this._render();
  }
  _go(dir) {
    const n = this.idx + dir;
    if (n < 0 || n >= ONBOARD_SLIDES.length) return;
    this.idx = n;
    this._render();
  }
  _markSeen() {
    if (this._finished) return;
    this._finished = true;
    if (this.plugin && !this.plugin.settings.onboarded) {
      this.plugin.settings.onboarded = true;
      this.plugin.saveAll();
    }
  }
  _render() {
    const { contentEl } = this;
    contentEl.empty();
    const s = ONBOARD_SLIDES[this.idx];
    const total = ONBOARD_SLIDES.length;
    const last = this.idx === total - 1;
    const card = contentEl.createDiv("er-onb-card" + (s.tone === "warn" ? " er-onb-warn" : ""));
    card.createDiv("er-onb-emoji").setText(s.emoji);
    card.createDiv("er-onb-title").setText(s.title);
    const body = card.createDiv("er-onb-body");
    (Array.isArray(s.body) ? s.body : [s.body]).forEach((p) => body.createEl("p").setText(p));
    const dots = contentEl.createDiv("er-onb-dots");
    ONBOARD_SLIDES.forEach((_, i) => {
      const d = dots.createDiv("er-onb-dot" + (i === this.idx ? " er-onb-dot-on" : ""));
      d.setAttribute("aria-label", __ertr("Экран {0}", i + 1));
      d.addEventListener("click", () => {
        this.idx = i;
        this._render();
      });
    });
    const nav = contentEl.createDiv("er-onb-nav");
    const prev = nav.createEl("button", { text: __ertr("‹ Назад") });
    prev.addClass("er-onb-prev");
    prev.disabled = this.idx === 0;
    prev.addEventListener("click", () => this._go(-1));
    nav.createDiv("er-onb-counter").setText(`${this.idx + 1} / ${total}`);
    const next = nav.createEl("button", { text: last ? __ertr("Начать читать") : __ertr("Далее ›") });
    next.addClass(last ? "er-onb-start" : "er-onb-next");
    next.addEventListener("click", () => {
      if (last) {
        this._markSeen();
        this.close();
      } else this._go(1);
    });
    const skip = contentEl.createDiv("er-onb-skip");
    skip.setText(last ? "" : __ertr("Пропустить"));
    if (!last) skip.addEventListener("click", () => {
      this._markSeen();
      this.close();
    });
  }
  onClose() {
    this._markSeen();
    this.contentEl.empty();
  }
};
async function persistCurrentReaderPosition(reader) {
  if (!(reader && reader.plugin && reader.file && reader.bookHtml && reader.pager)) return;
  const pager = reader.pager;
  const total = Math.max(1, pager.total || 1);
  let current = Math.max(0, Math.min(pager.spread || 0, total - 1));
  // The final scroll event may still be inside the paginator's debounce window
  // when the reader closes. Read the scroller directly so that last movement is
  // not lost just because the tab was closed quickly.
  if (pager.scrollMode && pager.clip) {
    const height = pager.clip.clientHeight || 1;
    current = Math.max(0, Math.min(Math.round(pager.clip.scrollTop / height), total - 1));
    pager.spread = current;
  }
  const saved = reader.plugin.getProgress(reader.file.path);
  let block = saved && typeof saved.block === "number" ? saved.block : null;
  // Obsidian detaches a leaf before onClose runs. Geometry reads on a detached
  // flow all collapse to zero, which makes currentBlockIndex return the final
  // paragraph in the book. Only refresh the anchor while the layout is live;
  // otherwise preserve the last anchor confirmed by a page/scroll event.
  if (pager.flow && pager.flow.isConnected && pager.clip && pager.clip.isConnected) {
    block = pager.currentBlockIndex();
  }
  try {
    await reader.plugin.saveProgress(reader.file.path, current, total, block);
  } catch (error) {
    console.warn("Book Reader: could not save the final reading position", error);
  }
}
const ReaderView = class extends ItemView {
  constructor(leaf, plugin) {
    super(leaf);
    this.file = null;
    this.ext = null;
    this.pager = new Paginator();
    this.pager.onSpreadChange = (cur, tot) => {
      (this.updateUI || this._updateUI).call(this, cur, tot);
      if (this.file) this.plugin.saveProgress(this.file.path, cur, tot, this.pager.currentBlockIndex());
    };
    this.bookHtml = "";
    this.tocItems = [];
    this.panelOpen = null;
    this.plugin = plugin;
    this._resizeTimer = null;
    this._lastWidth = 0;
    this._pendingSel = null;
    this._editHlId = null;
  }
  getViewType() {
    return VIEW_TYPE;
  }
  // The tab's "..." menu. A book opened in the reader used to have none of the
  // things every other file in Obsidian offers there — reveal in the folder
  // tree, rename, move, delete — which readers reported as the reader "taking
  // the file hostage". These come from Obsidian itself, so they stay correct.
  onPaneMenu(menu, source) {
    super.onPaneMenu(menu, source);
    addBookFileMenu(this.app, menu, this.file);
  }
  getDisplayText() {
    let _a, _b;
    return (_b = (_a = this.file) == null ? void 0 : _a.basename) != null ? _b : "Qiaomu Book Reader";
  }
  getIcon() {
    return "book-open";
  }
  getState() {
    let _a, _b;
    const p = (_b = (_a = this.file) == null ? void 0 : _a.path) != null ? _b : "";
    return { file: p, path: p };
  }
  async setState(state, result) {
    const path5 = (state == null ? void 0 : state.file) != null ? state.file : state == null ? void 0 : state.path;
    if (!path5)
      return;
    if (this.file && this.file.path === path5 && this.bookHtml)
      return;
    const f = this.app.vault.getAbstractFileByPath(path5);
    if (f instanceof TFile)
      await this.openFile(f);
  }
  async onOpen() {
    this.buildDOM();
    this._resizeObs = new ResizeObserver(() => {
      let _a;
      if (!this.bookHtml) return;
      if (this.containerEl.offsetParent === null) return;
      const w = this.areaEl.clientWidth;
      if (!w) return;
      if (Math.abs(w - (this._laidOutWidth || 0)) < 8) return;
      this._setRelayout(true);
      window.clearTimeout(this._resizeTimer);
      const delay = ((_a = this.app) == null ? void 0 : _a.isMobile) ? 500 : 260;
      this._resizeTimer = window.setTimeout(() => {
        const fw = this.areaEl.clientWidth;
        if (!fw || this.containerEl.offsetParent === null) {
          this._setRelayout(false);
          return;
        }
        if (Math.abs(fw - (this._laidOutWidth || 0)) < 8) {
          this._setRelayout(false);
          return;
        }
        this.repaginate();
      }, delay);
    });
    this._resizeObs.observe(this.areaEl);
    const recheck = () => {
      if (this._layoutWidthStale()) this.repaginate();
    };
    this.registerEvent(this.app.workspace.on("layout-change", recheck));
    this.registerEvent(this.app.workspace.on("active-leaf-change", (leaf) => {
      if (leaf === this.leaf) recheck();
    }));
  }
  async openFile(file) {
    let _a2, _b;
    let _a;
    this.file = file;
    this.ext = file.extension === "epub" ? "epub" : file.extension === "fb2" ? "fb2" : "pdf";
    this.bookHtml = "";
    this.tocItems = [];
    (_b = (_a2 = this._pdfLazy) == null ? void 0 : _a2.destroy) == null ? void 0 : _b.call(_a2);
    this._pdfLazy = null;
    this._pdfOutline = null;
    this.titleEl.setText(file.basename);
    this.applyVars();
    this.areaEl.empty();
    const loading = this.areaEl.createDiv("er-loading");
    loading.createDiv("er-spin");
    const loadText = loading.createDiv("er-loading-text");
    loadText.setText(__ertr("Загружаем книгу…"));
    await new Promise((r) => window.requestAnimationFrame(r));
    await new Promise((r) => window.requestAnimationFrame(r));
    try {
      if (this.ext === "epub") {
        this.bookHtml = await extractEpub(file, this.app);
      } else if (this.ext === "fb2") {
        this.bookHtml = await extractFb2(file, this.app);
      } else {
        const res = await extractPdf(file, this.app, this.plugin.settings, (i, n) => loadText.setText(__ertr("Готовим книгу… {0}%", Math.round(i / n * 100))));
        this.bookHtml = res.html;
        this._pdfLazy = res.lazy;
        this._pdfOutline = res.outline;
      }
      this.tocItems = buildTocItems(this.bookHtml, this._pdfOutline);
      this.buildTocPanel();
      await this.plugin.refreshProgress();
      await this.plugin.refreshHighlights();
      const saved = this.plugin.getProgress(file.path);
      const pct = (saved == null ? void 0 : saved.pct) != null ? saved.pct : 0;
      await this.paginate(pct, saved == null ? void 0 : saved.block);
      this.buildSettPanel();
      this._maybePromptBookNote(file);
      this._sessionSec = 0;
      this._running = false;
      this._goalNotified = this.plugin.getTodaySeconds() >= this.plugin.getGoalSeconds();
      updateGoalBar(this);
      updateTimerBtn(this);
    } catch (e) {
      console.error("Elton Reader:", e);
      new Notice(__ertr("Ошибка при открытии файла"));
    }
  }
  // On a book's first open, offer to pick its index note (from the configured
  // book-notes folder). Asks once per book; afterwards use the field/button in
  // the info panel. Skipped entirely unless a dedicated folder is configured, so
  // it never pops up over the whole vault for users who don't use this feature.
  _maybePromptBookNote(file) {
    const s = this.plugin.settings;
    if (!file) return;
    if (!s.bookNoteLinks) s.bookNoteLinks = {};
    if (!s.bookNotePrompted) s.bookNotePrompted = {};
    const action = bookNoteAction(s, file.path);
    if (action === "linked" || action === "prompted") return;
    if (action === "auto") {
      s.bookNotePrompted[file.path] = true;
      this.plugin.ensureBookNote(file).then((note) => {
        if (note) new Notice(__ertr("Заметка книги создана: {0}", note.basename));
        if (this.panelOpen === "settings") this.buildSettPanel();
      });
      return;
    }
    new BookSetupModal(this.app, this.plugin, file, () => {
      if (this.panelOpen === "settings") this.buildSettPanel();
    }).open();
  }
  async paginate(savedPct = 0, savedBlock = null) {
    this.areaEl.empty();
    let w = this.areaEl.clientWidth, a = 0;
    while (!w && a < 60) {
      await new Promise((r) => window.requestAnimationFrame(r));
      w = this.areaEl.clientWidth;
      a++;
    }
    if (!w) return;
    this.areaEl.addClass("er-booting");
    erShowVeil(this);
    window.setTimeout(() => {
      if (this.areaEl) this.areaEl.removeClass("er-booting");
      erHideVeil(this);
    }, 3e3);
    const [, total] = await this.pager.build(
      this.areaEl,
      this.bookHtml,
      this.plugin.settings,
      0
    );
    this._laidOutWidth = this.pager.builtWidth || w;
    const hasBlock = typeof savedBlock === "number" && savedBlock >= 0;
    const targetSpread = hasBlock ? this.pager.spreadForBlock(savedBlock) : Math.round(savedPct * Math.max(0, total - 1));
    this._renderFlowHighlights();
    const [cur, tot] = this.pager.jumpTo(targetSpread);
    this.updateUI(cur, tot);
    erRevealWhenSettled(this);
    if (hasBlock) this._flashBlock(savedBlock);
  }
  // Briefly highlight the paragraph the reader resumed at, so the eye finds it.
  // Jump to a paragraph as soon as the book is laid out. Called from a backlink,
  // which arrives while the book is still being built, so it waits for the
  // pager rather than assuming the text is already there. Gives up after a few
  // seconds instead of polling forever on a book that failed to open.
  // Land on a PDF page once the book is laid out. Pages are marked in the flow
  // with data-pdf-page-no, so this is a lookup rather than a guess.
  jumpToPdfPageWhenReady(pageNo) {
    let tries = 0;
    const tick = () => {
      const flow = this.pager && this.pager.flow;
      if (flow && this.pager.total) {
        const el = flow.querySelector(`[data-pdf-page-no="${pageNo}"]`);
        if (el) {
          const x = el.getBoundingClientRect().left - flow.getBoundingClientRect().left;
          const stride = this.pager.sw / (this.pager.cols || 1);
          const spread = Math.floor(Math.round(x / stride) / (this.pager.cols || 1));
          const [cur, tot] = this.pager.jumpTo(Math.max(0, Math.min(spread, this.pager.total - 1)));
          (this.updateUI || this._updateUI).call(this, cur, tot);
          return;
        }
      }
      if (++tries > 40) return;
      window.setTimeout(tick, 100);
    };
    tick();
  }
  jumpToBlockWhenReady(idx) {
    let tries = 0;
    const tick = () => {
      if (this.pager && this.pager.flow && this.pager.total) {
        const [cur, tot] = this.pager.jumpTo(this.pager.spreadForBlock(idx));
        (this.updateUI || this._updateUI).call(this, cur, tot);
        this._flashBlock(idx);
        return;
      }
      if (++tries > 40) return;
      window.setTimeout(tick, 100);
    };
    tick();
  }
  _flashBlock(idx) {
    const el = this.pager.blockEl(idx);
    if (!el) return;
    el.classList.remove("er-resume-flash");
    void el.offsetWidth;
    el.classList.add("er-resume-flash");
    window.setTimeout(() => el.classList.remove("er-resume-flash"), 2400);
  }
  // Paint every occurrence of the search term in the book, so that after jumping
  // to a result the eye finds the actual word instead of hunting through the
  // paragraph.
  //
  // Uses the CSS Custom Highlight API: it draws over existing text WITHOUT
  // touching the DOM. Wrapping matches in <span> would have been the obvious
  // route, but inserting elements into the flow re-runs the column layout and
  // would disturb both pagination and the reader's own <mark> highlights.
  _markFound(query) {
    markFoundIn(this, query);
  }
  _clearFound() {
    clearFoundIn(this);
  }
  // Jump to the page holding a global block index, flash it, save the position.
  // Used by the TOC panel.
  _jumpToBlock(block, flash = true) {
    if (!this.bookHtml || typeof block !== "number") return;
    const [cur, tot] = this.pager.jumpTo(this.pager.spreadForBlock(block));
    this.updateUI(cur, tot);
    if (this.file) this.plugin.saveProgress(this.file.path, cur, tot, this.pager.currentBlockIndex());
    if (flash) this._flashBlock(block);
  }
  // Repaginate preserving current reading % (used on settings change)
  // Show/hide the "re-laying out" veil: the page blurs and a spinner fades in.
  // The class goes on the ROOT, not on the reading area, because the spinner has
  // to sit OUTSIDE the blurred element — a child of it would be blurred too.
  _setRelayout(on) {
    if (!on) erHideVeil(this);
    const root = this.contentEl;
    if (!root) return;
    if (on && !this._spinEl) {
      this._spinEl = root.createDiv("er-relayout-spin");
      this._spinEl.createDiv("er-relayout-ring");
    }
    root.toggleClass("er-relayouting", !!on);
  }
  async repaginate() {
    if (!this.bookHtml) return;
    if (!this.areaEl.clientWidth || this.containerEl.offsetParent === null) return;
    const savedBlock = this.pager.currentBlockIndex();
    const savedPct = this.pager.currentPct;
    this._setRelayout(true);
    erShowVeil(this);
    try {
      await new Promise((r) => window.requestAnimationFrame(r));
      this.areaEl.empty();
      const [, total] = await this.pager.build(
        this.areaEl,
        this.bookHtml,
        this.plugin.settings,
        0
      );
      this._laidOutWidth = this.pager.builtWidth || this.areaEl.clientWidth;
      const w = this.areaEl.clientWidth;
      this._staleGaveUpAt = w && Math.abs(w - (this.pager.builtWidth || 0)) >= 8 ? this.pager.builtWidth : null;
      const targetSpread = typeof savedBlock === "number" && savedBlock >= 0 ? this.pager.spreadForBlock(savedBlock) : Math.round(savedPct * Math.max(0, total - 1));
      this._renderFlowHighlights();
      const [cur, tot] = this.pager.jumpTo(targetSpread);
      this.updateUI(cur, tot);
      if (this._tocRender) this._tocRender();
      this._findCorpus = null;
      if (this._foundQuery) this._markFound(this._foundQuery);
    } finally {
      window.requestAnimationFrame(() => this._setRelayout(false));
    }
  }
  // ── DOM ──────────────────────────────────────────────
  buildDOM() {
    const root = this.contentEl;
    root.empty();
    root.addClass("er-view");
    this.applyVars();
    const pb = root.createDiv("er-pbar");
    this.pbarFill = pb.createDiv("er-pbar-fill");
    const top = root.createDiv("er-top");
    const lb = top.createDiv("er-ibtn");
    svgIcon(lb, "arrow-left");
    lb.addEventListener("click", () => this.plugin.openLibrary());
    this.titleEl = top.createDiv("er-top-title");
    this.titleEl.setText("Qiaomu Book Reader");
    const tr = top.createDiv("er-top-right");
    this.timerBtnEl = tr.createDiv("er-timerbtn");
    this.timerIconEl = this.timerBtnEl.createDiv("er-timer-ic");
    this.timerLabelEl = this.timerBtnEl.createDiv("er-timer-label");
    this.timerResetEl = this.timerBtnEl.createDiv("er-timer-reset");
    svgIcon(this.timerResetEl, "rotate-ccw");
    this.timerResetEl.setAttribute("aria-label", __ertr("Сбросить таймер"));
    this.timerResetEl.addEventListener("click", (e) => {
      e.stopPropagation();
      resetTimerSession(this);
    });
    this.timerBtnEl.setAttribute("aria-label", __ertr("Таймер: сколько осталось до цели — старт/пауза"));
    this.timerBtnEl.addEventListener("click", () => toggleTimerSession(this));
    updateTimerBtn(this);
    const noteBtn = tr.createDiv("er-ibtn");
    svgIcon(noteBtn, "note");
    noteBtn.setAttribute("aria-label", __ertr("Заметка книги"));
    noteBtn.addEventListener("click", () => openOrCreateBookNoteBeside(this.plugin, this.file));
    const hlBtn = tr.createDiv("er-ibtn");
    svgIcon(hlBtn, "highlighter");
    hlBtn.setAttribute("aria-label", __ertr("Выделения"));
    hlBtn.addEventListener("click", () => this.togglePanel("highlights"));
    const findBtn = tr.createDiv("er-ibtn");
    svgIcon(findBtn, "search");
    findBtn.setAttribute("aria-label", __ertr("Поиск по книге"));
    findBtn.addEventListener("click", () => {
      this.togglePanel("find");
      if (this._findInput) erAutoFocus(this._findInput, 60);
    });
    const tocBtn = tr.createDiv("er-ibtn");
    svgIcon(tocBtn, "list");
    tocBtn.setAttribute("aria-label", __ertr("Оглавление"));
    tocBtn.addEventListener("click", () => this.togglePanel("toc"));
    const setBtn = tr.createDiv("er-ibtn");
    svgIcon(setBtn, "sliders");
    setBtn.setAttribute("aria-label", __ertr("Настройки чтения"));
    setBtn.addEventListener("click", () => new ReadSettingsModal(this.app, this).open());
    this.areaEl = root.createDiv("er-area");
    if ((this.plugin.settings.navMode || "buttons") === "click") root.addClass("er-navclick");
    const bot = root.createDiv("er-bot");
    const pv = bot.createDiv("er-navbtn");
    svgIcon(pv, "chevron-left");
    pv.addEventListener("click", () => this.nav("prev"));
    const center = bot.createDiv("er-bot-center");
    this.locEl = center.createDiv("er-loc er-loc-clickable");
    this.locEl.setAttribute("aria-label", __ertr("Перейти к странице"));
    this.locEl.addEventListener("click", () => {
      if (!this.file || !this.pager || !this.pager.total) return;
      new GoToPageModal(this.app, this.pager.total, this.pager.spread, (n) => {
        const [cur, tot] = this.pager.jumpTo(n - 1);
        this.updateUI(cur, tot);
        this.plugin.saveProgress(this.file.path, cur, tot, this.pager.currentBlockIndex());
      }).open();
    });
    this.pctEl = center.createDiv("er-pct");
    this.pctEl.setText("0%");
    const nx = bot.createDiv("er-navbtn");
    svgIcon(nx, "chevron-right");
    nx.addEventListener("click", () => this.nav("next"));
    this.overlayEl = root.createDiv("er-overlay");
    this.overlayEl.addEventListener("click", () => this.closePanel());
    this.settPan = root.createDiv("er-panel");
    this.tocPan = root.createDiv("er-panel er-toc-panel");
    this.hlPan = root.createDiv("er-panel er-toc-panel er-hl-panel");
    this.findPan = root.createDiv("er-panel er-toc-panel er-find-panel");
    this.buildSettPanel();
    this.buildTocPanel();
    this.buildHlPanel();
    this.buildFindPanel();
    this.hlPopup = root.createDiv("er-hl-popup");
    this.buildHlPopup();
    this.registerDomEvent(docOf(this.containerEl), "selectionchange", () => this._scheduleSelCheck());
    this.areaEl.addEventListener("mouseup", () => this._scheduleSelCheck());
    this.areaEl.addEventListener("click", (e) => {
      const refEl = e.target instanceof HTMLElement ? e.target.closest("[data-er-ref]") : null;
      if (refEl) {
        e.preventDefault();
        e.stopPropagation();
        if (followFootnote(this, refEl.getAttribute("data-er-ref"))) return;
      }
      const imgEl = e.target instanceof HTMLElement ? e.target.closest("img") : null;
      if (imgEl && imgEl.src) {
        e.preventDefault();
        openImageLightbox(imgEl.currentSrc || imgEl.src, this.app, imgEl);
        return;
      }
      const span = e.target instanceof HTMLElement ? e.target.closest(".er-hl") : null;
      if (span) {
        e.preventDefault();
        this._openHlEdit(span.getAttribute("data-hl-id"));
      } else if (this._editHlId) {
        this._hideHlPopup();
      }
    });
    this.registerDomEvent(docOf(this.containerEl), "mousedown", (e) => {
      if (!this._editHlId) return;
      const t = e.target;
      if (this.hlPopup.contains(t)) return;
      if (t instanceof HTMLElement && t.closest(".er-hl")) return;
      this._hideHlPopup();
    });
    this.areaEl.addEventListener("contextmenu", (e) => {
      const sel = selOf(this.areaEl);
      const text = sel && !sel.isCollapsed && sel.rangeCount ? sel.toString() : "";
      const flow = this.pager.flow;
      if (!text.trim() || !flow || !flow.contains(sel.getRangeAt(0).startContainer)) return;
      e.preventDefault();
      const menu = new Menu();
      menu.addItem((it) => it.setTitle(__ertr("Скопировать как цитату")).setIcon("text-quote").onClick(async () => {
        this._hideHlPopup();
        const md = quoteMarkdown(this.plugin, { text, block: this._pendingSel && this._pendingSel.block, page: this._pendingSel && this._pendingSel.page }, this.file);
        const okc = md && await copyToClipboard(md);
        new Notice(okc ? __ertr("Цитата скопирована ✓ — вставьте в любую заметку") : __ertr("Не удалось скопировать"));
      }));
      menu.addItem((it) => it.setTitle(__ertr("Создать новую заметку")).setIcon("file-plus").onClick(() => {
        this._hideHlPopup();
        createNoteFromSelection(this.app, this.plugin, text, this.file);
      }));
      menu.addItem((it) => it.setTitle(__ertr("Текстом в заметку книги")).setIcon("text-quote").onClick(() => {
        this._hideHlPopup();
        sendQuoteToBookNote(this, { text, block: this._pendingSel && this._pendingSel.block });
      }));
      if (this.plugin.settings.aiEnabled) {
        menu.addItem((it) => it.setTitle(__ertr("Разобрать фрагмент")).setIcon("sparkles").onClick(() => {
          this._hideHlPopup();
          new AiExplainModal(this.app, this.plugin, text, this.file).open();
        }));
      }
      if (this.plugin.settings.translateEnabled) {
        menu.addItem((it) => it.setTitle(__ertr("Перевести")).setIcon("languages").onClick(() => {
          this._hideHlPopup();
          new TranslateModal(this.app, this.plugin, text, this.file).open();
        }));
      }
      menu.addSeparator();
      HL_COLORS.forEach((c) => {
        menu.addItem((it) => it.setTitle(__ertr("Выделить: {0}", c.label())).onClick(() => {
          this._onSelectionCheck();
          this._applyPopupColor(c.id);
        }));
      });
      menu.showAtMouseEvent(e);
    });
    this.registerDomEvent(docOf(this.containerEl), "keydown", (e) => {
      let _a;
      if (!this.bookHtml)
        return;
      const ae = docOf(this.areaEl).activeElement;
      if (ae && (ae.tagName === "INPUT" || ae.tagName === "TEXTAREA" || ae.isContentEditable))
        return;
      if (!this.containerEl.contains(ae) && this.app.workspace.getActiveViewOfType(this.constructor) !== this)
        return;
      if (e.key === "ArrowRight" || e.key === "ArrowDown" || e.key === " ") {
        e.preventDefault();
        this.nav("next");
      }
      if (e.key === "ArrowLeft" || e.key === "ArrowUp") {
        e.preventDefault();
        this.nav("prev");
      }
    });
    let sx = 0, sy = 0, _swipeDir = null, _longPress = false, _lpTimer = null, _hadSel = false;
    this.areaEl.addEventListener("touchstart", (e) => {
      if (e.touches.length > 1) {
        _swipeDir = "v";
        return;
      }
      sx = e.touches[0].clientX;
      sy = e.touches[0].clientY;
      _swipeDir = null;
      _longPress = false;
      const sel = selOf(this.areaEl);
      _hadSel = !!(sel && !sel.isCollapsed);
      window.clearTimeout(_lpTimer);
      _lpTimer = window.setTimeout(() => {
        _longPress = true;
      }, 350);
    }, { passive: true });
    this.areaEl.addEventListener("touchmove", (e) => {
      if (_swipeDir !== null) {
        if (_swipeDir === "h") e.preventDefault();
        return;
      }
      const dx = Math.abs(e.touches[0].clientX - sx);
      const dy = Math.abs(e.touches[0].clientY - sy);
      if (dx < 8 && dy < 8) return;
      window.clearTimeout(_lpTimer);
      const sel = selOf(this.areaEl);
      if (_longPress || _hadSel || sel && !sel.isCollapsed) {
        _swipeDir = "v";
        return;
      }
      _swipeDir = dx > dy ? "h" : "v";
      if (_swipeDir === "h") e.preventDefault();
    }, { passive: false });
    this.areaEl.addEventListener("touchend", (e) => {
      window.clearTimeout(_lpTimer);
      if (_swipeDir !== "h") return;
      const dx = e.changedTouches[0].clientX - sx;
      if (Math.abs(dx) > 44)
        dx < 0 ? this.nav("next") : this.nav("prev");
    }, { passive: true });
    this.areaEl.addEventListener("click", (e) => handleAreaNavClick(this, e));
    const armImmersive = () => {
      if (!this.plugin.settings.immersive) {
        root.removeClass("er-immersive");
        return;
      }
      root.removeClass("er-immersive");
      window.clearTimeout(this._immTimer);
      this._immTimer = window.setTimeout(() => {
        if (this.bookHtml) root.addClass("er-immersive");
      }, 2600);
    };
    root.addEventListener("pointermove", armImmersive);
    root.addEventListener("pointerdown", armImmersive);
    root.addEventListener("touchstart", armImmersive, { passive: true });
    armImmersive();
  }
  applyVars() {
    const t = erTheme(this.plugin.settings);
    const s = this.plugin.settings;
    const r = this.contentEl;
    r.style.setProperty("--er-bg", t.bg);
    r.style.setProperty("--er-text", t.text);
    r.style.setProperty("--er-ui", t.ui);
    r.style.setProperty("--er-border", t.border);
    r.style.setProperty("--er-accent", t.accent);
    r.style.setProperty("--er-muted", t.muted);
    r.toggleClass("er-eink", s.einkMode === true);
  }
  nav(dir) {
    if (!this.bookHtml)
      return;
    const _now = Date.now();
    if (this._lastNavTs && _now - this._lastNavTs < 90) return;
    this._lastNavTs = _now;
    this._lastActive = _now;
    if (this._layoutWidthStale()) {
      this.repaginate().then(() => this._navNow(dir)).catch(() => this._navNow(dir));
      return;
    }
    this._navNow(dir);
  }
  _navNow(dir) {
    if (!this.bookHtml) return;
    this._hideHlPopup();
    const [cur, total] = dir === "next" ? this.pager.next() : this.pager.prev();
    this.updateUI(cur, total);
    this.plugin.saveProgress(this.file.path, cur, total, this.pager.currentBlockIndex());
  }
  // True when the page is laid out for a different width than it is displayed at.
  // `builtWidth` is what the paginator actually measured, so this compares like
  // with like — the width the caller *intended* can differ from it.
  _layoutWidthStale() {
    if (!this.bookHtml || !this.pager || !this.pager.builtWidth) return false;
    if (this.containerEl.offsetParent === null) return false;
    if (this._staleGaveUpAt === this.pager.builtWidth) return false;
    const now = this.areaEl.clientWidth;
    if (!now) return false;
    return Math.abs(now - this.pager.builtWidth) >= 8;
  }
  exportHighlights(evt) {
    if (!this.file) {
      new Notice(__ertr("Книга не открыта"));
      return;
    }
    const list = enrichHighlights(this, this.plugin.getHighlights(this.file.path));
    exportHighlightsMenu(this.app, this.plugin, this.file, list, evt);
  }
  updateUI(cur, total) {
    // В прокрутке листать нечего: стрелки и клик по краю там ничего не делают
    // и только занимают место. Класс снимает их из вида одним правилом.
    if (this.contentEl) this.contentEl.toggleClass("er-scrolling", !!(this.pager && this.pager.scrollMode));
    const pct = total > 0 ? Math.round((cur + 1) / total * 100) : 0;
    this.pbarFill.style.width = `${pct}%`;
    const bookPage = currentBookPage(this);
    const where = this.ext === "pdf" ? __ertr("Разворот {0} из {1}", cur + 1, total) : `${cur + 1} / ${total}`;
    this.locEl.setText(bookPage ? __ertr("стр. {0}", bookPage) + " \xB7 " + where : where);
    this.pctEl.setText(`${pct}%`);
    renderVisibleFigures(this);
  }
  // ── Settings panel ────────────────────────────────────
  buildSettPanel() {
    const p = this.settPan;
    p.empty();
    p.createDiv("er-pan-title").setText(__ertr("Настройки чтения"));
    const sec = (l) => p.createDiv("er-pan-sec").setText(l);
    sec(__ertr("Тема"));
    const thRow = p.createDiv("er-theme-row");
    ["auto", "dark", "light", "sepia", "eink"].forEach((t) => {
      const btn = thRow.createDiv(`er-theme-btn er-theme-${t}`);
      btn.setText({ auto: __ertr("Как в Obsidian"), dark: __ertr("Тёмная"), light: __ertr("Светлая"), sepia: __ertr("Сепия"), eink: "E-ink" }[t]);
      if (this.plugin.settings.theme === t)
        btn.addClass("active");
      btn.addEventListener("click", async () => {
        this.plugin.settings.theme = t;
        await this.plugin.saveAll();
        this.applyVars();
        if (this.bookHtml)
          await this.repaginate();
        thRow.querySelectorAll(".er-theme-btn").forEach((b) => b.removeClass("active"));
        btn.addClass("active");
      });
    });
    sec(__ertr("Размер шрифта"));
    const szRow = p.createDiv("er-sz-row");
    const szM = szRow.createDiv("er-sz-btn");
    szM.setText("A−");
    const szL = szRow.createDiv("er-sz-label");
    szL.setText(`${this.plugin.settings.fontSize}px`);
    const szP = szRow.createDiv("er-sz-btn");
    szP.setText("A+");
    const changeSz = async (d) => {
      const nv = this.plugin.settings.fontSize + d;
      if (nv < 12 || nv > 36)
        return;
      this.plugin.settings.fontSize = nv;
      szL.setText(`${nv}px`);
      await this.plugin.saveAll();
      if (this.bookHtml)
        await this.repaginate();
    };
    szM.addEventListener("click", () => changeSz(-1));
    szP.addEventListener("click", () => changeSz(1));
    const advHdr = p.createDiv("er-pan-adv-hdr");
    advHdr.createSpan({ cls: "er-pan-adv-ic", text: "⚙️" });
    advHdr.createSpan({ cls: "er-pan-adv-lbl", text: __ertr("Доп. настройки") });
    const advCar = advHdr.createSpan({ cls: "er-pan-adv-car", text: "›" });
    const advWrap = p.createDiv("er-pan-adv");
    const adv = advWrap.createDiv("er-pan-adv-body");
    const secA = (l) => adv.createDiv("er-pan-sec").setText(l);
    if (this.plugin.settings.readerAdvOpen) {
      advWrap.addClass("er-pan-adv-on");
      advCar.addClass("er-pan-adv-car-on");
    }
    advHdr.addEventListener("click", async () => {
      const on = advWrap.hasClass("er-pan-adv-on");
      advWrap.toggleClass("er-pan-adv-on", !on);
      advCar.toggleClass("er-pan-adv-car-on", !on);
      this.plugin.settings.readerAdvOpen = !on;
      await this.plugin._saveLocalData();
    });
    secA(__ertr("Шрифт"));
    const ffRow = adv.createDiv("er-ff-row");
    erReaderFonts().forEach((font) => {
      const f = font.id;
      const btn = ffRow.createDiv("er-ff-btn");
      btn.setText(erFontLabel(font));
      btn.style.fontFamily = font.stack;
      if (this.plugin.settings.fontFamily === f)
        btn.addClass("active");
      btn.addEventListener("click", async () => {
        this.plugin.settings.fontFamily = f;
        await this.plugin.saveAll();
        if (this.bookHtml)
          await this.repaginate();
        ffRow.querySelectorAll(".er-ff-btn").forEach((b) => b.removeClass("active"));
        btn.addClass("active");
      });
    });
    secA(__ertr("Межстрочный"));
    const lhRow = adv.createDiv("er-lh-row");
    [1.4, 1.6, 1.8, 2.1].forEach((lh) => {
      const btn = lhRow.createDiv("er-lh-btn");
      btn.setText(`${lh}`);
      if (Math.abs(this.plugin.settings.lineHeight - lh) < 0.05)
        btn.addClass("active");
      btn.addEventListener("click", async () => {
        this.plugin.settings.lineHeight = lh;
        await this.plugin.saveAll();
        if (this.bookHtml)
          await this.repaginate();
        lhRow.querySelectorAll(".er-lh-btn").forEach((b) => b.removeClass("active"));
        btn.addClass("active");
      });
    });
    secA(__ertr("Страниц рядом"));
    const colRow = adv.createDiv("er-col-row");
    [["1", __ertr("1 страница")], ["2", __ertr("2 страницы")]].forEach(([v, label]) => {
      const btn = colRow.createDiv("er-col-btn");
      btn.setText(label);
      if (this.plugin.settings.columns === v)
        btn.addClass("active");
      btn.addEventListener("click", async () => {
        this.plugin.settings.columns = v;
        await this.plugin.saveAll();
        if (this.bookHtml)
          await this.repaginate();
        colRow.querySelectorAll(".er-col-btn").forEach((b) => b.removeClass("active"));
        btn.addClass("active");
      });
    });
    buildReaderExtraSettings(this, adv);
    this._histRow = panelSection(this, p, {
      label: __ertr("Вернуться к месту"),
      emoji: "\u{1F516}",
      settingKey: "readerHistOpen"
    }).createDiv("er-hist-row");
    this._renderHistory();
    sec(__ertr("Действия"));
    const actRow = p.createDiv("er-act-row");
    const mkAct = (label, ic, fn) => {
      const b = actRow.createDiv("er-act-btn");
      iconLabel(b, ic, label);
      b.addEventListener("click", fn);
    };
    mkAct(__ertr("Справка"), "info", () => new InfoModal(this.app, this.plugin, this.file).open());
  }
  _renderHistory() {
    const c = this._histRow;
    if (!c) return;
    c.empty();
    const list = this.file ? this.plugin.getBackups(this.file.path) : [];
    const badge = c.parentElement && c.parentElement._erCount;
    if (badge) badge.setText(list.length ? String(list.length) : "");
    if (!list.length) {
      c.createDiv("er-hist-empty").setText(__ertr("Точек пока нет"));
      return;
    }
    [...list].reverse().slice(0, 14).forEach((snap) => {
      const chip = c.createDiv("er-hist-chip");
      const d = new Date(snap.ts || snap.lastRead || Date.now());
      chip.setText(`${snap.percent}% \xB7 ${d.toLocaleString(__erLocale(), { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" })}`);
      chip.addEventListener("click", () => {
        if (!this.bookHtml) return;
        const total = this.pager.total;
        let target;
        if (typeof snap.block === "number" && snap.block >= 0) {
          target = this.pager.spreadForBlock(snap.block);
        } else {
          const frac = typeof snap.pct === "number" ? snap.pct : (snap.percent || 0) / 100;
          target = Math.round(frac * Math.max(0, total - 1));
        }
        const [cur, tot] = this.pager.jumpTo(target);
        this.updateUI(cur, tot);
        if (this.file) this.plugin.saveProgress(this.file.path, cur, tot, this.pager.currentBlockIndex());
        this.closePanel();
        new Notice(__ertr("Вернулись к {0}%", snap.percent));
      });
    });
  }
  buildTocPanel() {
    this._tocRender = buildTocPanelFor(this, this.tocPan, {
      close: () => this.closePanel(),
      jump: (b) => this._jumpToBlock(b)
    });
  }
  // Find text anywhere in the open book. Results are block indexes — the same
  // anchor reading position and the contents list use — so a hit lands correctly
  // whatever the window width or column count.
  buildFindPanel() {
    buildFindPanelFor(this, this.findPan, {
      close: () => this.closePanel(),
      jump: (b) => this._jumpToBlock(b)
    });
  }
  togglePanel(name) {
    if (this.panelOpen === name) {
      this.closePanel();
      return;
    }
    this._hideHlPopup();
    if (name === "highlights") this.buildHlPanel();
    if (name === "settings") this._renderHistory();
    if (name === "toc" && this._tocRender) this._tocRender();
    this.panelOpen = name;
    this.settPan.classList.toggle("er-panel-open", name === "settings");
    this.tocPan.classList.toggle("er-panel-open", name === "toc");
    this.findPan.classList.toggle("er-panel-open", name === "find");
    this.hlPan.classList.toggle("er-panel-open", name === "highlights");
    if (this.findPan) this.findPan.classList.toggle("er-panel-open", name === "find");
    if (name === "toc" && this._tocRender) this._tocRender();
    this.overlayEl.classList.add("er-overlay-on");
  }
  closePanel() {
    this.panelOpen = null;
    this.settPan.classList.remove("er-panel-open");
    this.tocPan.classList.remove("er-panel-open");
    this.hlPan.classList.remove("er-panel-open");
    if (this.findPan) this.findPan.classList.remove("er-panel-open");
    this.overlayEl.classList.remove("er-overlay-on");
  }
  // ── Refresh: save progress + rebuild cleanly (kills stray column) ──────
  async reloadView() {
    if (!this.bookHtml || !this.file) {
      new Notice(__ertr("Нечего обновлять"));
      return;
    }
    const cur = this.pager.spread, tot = this.pager.total;
    this.plugin.saveProgress(this.file.path, cur, tot, this.pager.currentBlockIndex());
    const pct = this.pager.currentPct;
    this._hideHlPopup();
    this.closePanel();
    await this.plugin.refreshHighlights();
    this._lastWidth = this.areaEl.clientWidth;
    await this.paginate(pct);
    new Notice(__ertr("Обновлено"));
  }
  // ── Highlights: render / select / navigate ────────────
  _renderFlowHighlights() {
    if (!this.file || !this.pager.flow) return;
    const flow = this.pager.flow;
    unwrapAllHighlights(flow);
    const blocks = flow.querySelectorAll("p,h1,h2,h3,h4");
    const list = this.plugin.getHighlights(this.file.path);
    for (const hl of list) {
      const block = blocks[hl.block];
      if (!block) continue;
      const text = block.textContent;
      const loc = locateHl(text, hl);
      if (!loc) continue;
      wrapBlockRange(block, loc.start, loc.start + loc.len, { id: hl.id, color: hlColorCss(hl.color) });
    }
  }
  _scheduleSelCheck() {
    window.clearTimeout(this._selTimer);
    this._selTimer = window.setTimeout(() => this._onSelectionCheck(), 60);
  }
  _onSelectionCheck() {
    if (this._editHlId || this._commentEditing) return;
    const sel = selOf(this.areaEl);
    if (!sel || sel.isCollapsed || sel.rangeCount === 0) {
      this._hideHlPopup();
      return;
    }
    const range = sel.getRangeAt(0);
    const flow = this.pager.flow;
    if (!flow || !flow.contains(range.startContainer)) {
      this._hideHlPopup();
      return;
    }
    let node = range.startContainer;
    if (node.nodeType === Node.TEXT_NODE) node = node.parentElement;
    const block = node ? node.closest("p,h1,h2,h3,h4") : null;
    if (!block || !flow.contains(block)) {
      this._hideHlPopup();
      return;
    }
    const blocks = [...flow.querySelectorAll("p,h1,h2,h3,h4")];
    const blockIndex = blocks.indexOf(block);
    if (blockIndex < 0) {
      this._hideHlPopup();
      return;
    }
    const parts = [];
    for (let bi = blockIndex; bi < blocks.length; bi++) {
      const b = blocks[bi];
      if (bi > blockIndex && !range.intersectsNode(b)) break;
      const bText = b.textContent;
      const from = bi === blockIndex ? offsetInBlock(b, range.startContainer, range.startOffset) : 0;
      const ends = b.contains(range.endContainer);
      const to = ends ? offsetInBlock(b, range.endContainer, range.endOffset) : bText.length;
      if (to > from) {
        const seg = bText.slice(from, to);
        if (seg.trim()) {
          parts.push({
            block: bi,
            occ: countOccurrencesBefore(bText, seg, from),
            text: seg,
            pre: bText.slice(Math.max(0, from - 32), from),
            post: bText.slice(to, to + 32)
          });
        }
      }
      if (ends) break;
    }
    if (!parts.length) {
      this._hideHlPopup();
      return;
    }
    this._pendingSel = { ...parts[0], parts, text: parts.map((p) => p.text).join(" ") };
    erPaintSelection(this, range);
    this._showHlPopup(erSelectionRect(range, this.areaEl));
  }
  buildHlPopup() {
    const pop = this.hlPopup;
    pop.empty();
    pop.addEventListener("mousedown", (e) => {
      if (!(e.target instanceof HTMLElement) || !e.target.closest(".er-hl-comment-editor")) e.preventDefault();
    });
    addBarButtons(this, pop);
  }
  _applyPopupColor(colorId) {
    let _a, _b;
    if (this._editHlId && this.file) {
      const id = this._editHlId;
      this.plugin.setHighlightColor(this.file.path, id, colorId);
      (_a = this.pager.flow) == null ? void 0 : _a.querySelectorAll(`[data-hl-id="${id}"]`).forEach((s) => {
        s.style.background = hlColorCss(colorId);
      });
      if (this.panelOpen === "highlights") this.buildHlPanel();
      this._hideHlPopup();
      return;
    }
    if (this._pendingSel && this.file) {
      const parts = this._pendingSel.parts || [this._pendingSel];
      const made = [];
      for (const part of parts) {
        const id = this._createHighlight(part, colorId);
        if (id) made.push({ ...part, id, color: colorId });
      }
      (_b = selOf(this.areaEl)) == null ? void 0 : _b.removeAllRanges();
      if (this.panelOpen === "highlights") this.buildHlPanel();
      // The persistence chain synchronises the complete managed section in the
      // reading note. Doing a second append here created duplicate excerpts and
      // could not update a comment added later.
    }
    this._hideHlPopup();
  }
  // Save a highlight for a pending selection and paint it in the text.
  // Returns its id — the comment button needs it, because commenting on a plain
  // selection has to create the highlight first (otherwise the note had nothing
  // to attach to and silently vanished).
  _createHighlight(sel, colorId) {
    if (!sel || !this.file) return null;
    const id = "h" + Date.now().toString(36) + Math.random().toString(36).slice(2, 6);
    const hl = { id, color: colorId, text: sel.text, block: sel.block, occ: sel.occ, pre: sel.pre, post: sel.post, created: Date.now() };
    this.plugin.addHighlight(this.file.path, hl);
    const blocks = this.pager.flow.querySelectorAll("p,h1,h2,h3,h4");
    const block = blocks[hl.block];
    if (block) {
      const t = block.textContent;
      const loc = locateHl(t, hl);
      if (loc) wrapBlockRange(block, loc.start, loc.start + loc.len, { id: hl.id, color: hlColorCss(colorId) });
    }
    return id;
  }
  _currentHl() {
    if (this._editHlId && this.file) {
      const hl = this.plugin.getHighlights(this.file.path).find((h) => h.id === this._editHlId);
      if (hl) return { text: hl.text || "", block: hl.block, color: hl.color };
    }
    if (this._pendingSel) return { text: this._pendingSel.text || "", block: this._pendingSel.block, color: null };
    return null;
  }
  _openHlEdit(id) {
    let _a;
    const span = (_a = this.pager.flow) == null ? void 0 : _a.querySelector(`[data-hl-id="${id}"]`);
    if (!span) return;
    this._pendingSel = null;
    this._editHlId = id;
    this._showHlPopup(span.getBoundingClientRect());
  }
  _unwrapHighlight(id) {
    const flow = this.pager.flow;
    if (!flow) return;
    flow.querySelectorAll(`[data-hl-id="${id}"]`).forEach((span) => {
      const parent2 = span.parentNode;
      while (span.firstChild) parent2.insertBefore(span.firstChild, span);
      parent2.removeChild(span);
      parent2.normalize();
    });
  }
  _showHlPopup(rect) {
    const pop = this.hlPopup;
    this._hlPopupRect = rect;
    pop.classList.add("er-hl-popup-on");
    positionHlPopup(this, rect, 260, 44);
  }
  _hideHlPopup() {
    erClearPaintedSelection();
    closeInlineHighlightComment(this);
    this._hlPopupRect = null;
    this._pendingSel = null;
    this._editHlId = null;
    if (this.hlPopup) this.hlPopup.classList.remove("er-hl-popup-on");
  }
  goToHighlight(id) {
    const flow = this.pager.flow;
    const span = flow == null ? void 0 : flow.querySelector(`[data-hl-id="${id}"]`);
    // Нарисованного выделения может не быть: в PDF страницы подставляются по
    // мере чтения, и краска ложится только на те, что уже показаны. Раньше в
    // этом случае клик по строке в списке отвечал «Выделение не найдено» и
    // никуда не вёл. Абзац известен всегда — по нему и прыгаем, как на телефоне.
    if (!span) {
      const hl = this.file ? this.plugin.getHighlights(this.file.path).find((h) => h.id === id) : null;
      if (!hl || typeof hl.block !== "number") {
        new Notice(__ertr("Выделение не найдено"));
        return;
      }
      const [c2, t2] = this.pager.jumpTo(this.pager.spreadForBlock(hl.block));
      this.updateUI(c2, t2);
      if (this.file) this.plugin.saveProgress(this.file.path, c2, t2, this.pager.currentBlockIndex());
      this.closePanel();
      window.requestAnimationFrame(() => {
        const later = this.pager.flow?.querySelector(`[data-hl-id="${id}"]`);
        if (later) {
          later.classList.add("er-hl-flash");
          window.setTimeout(() => later.classList.remove("er-hl-flash"), 1200);
        }
      });
      return;
    }
    const rel = span.getBoundingClientRect().left - flow.getBoundingClientRect().left;
    const spread = Math.max(0, Math.floor(rel / this.pager.sw + 1e-3));
    const [cur, tot] = this.pager.jumpTo(spread);
    this.updateUI(cur, tot);
    if (this.file) this.plugin.saveProgress(this.file.path, cur, tot, this.pager.currentBlockIndex());
    this.closePanel();
    span.classList.add("er-hl-flash");
    window.setTimeout(() => span.classList.remove("er-hl-flash"), 1200);
  }
  buildHlPanel() {
    const p = this.hlPan;
    p.empty();
    p.createDiv("er-pan-title").setText(__ertr("Выделения"));
    const list = this.file ? this.plugin.getHighlights(this.file.path) : [];
    if (!list.length) {
      p.createDiv("er-toc-empty").setText(__ertr("Пока нет выделений.\nВыделите текст и выберите цвет."));
      return;
    }
    const exp = p.createDiv("er-hl-export");
    iconLabel(exp, "download", __ertr("Экспортировать в заметки ({0})", list.length));
    exp.setAttribute("aria-label", __ertr("Экспортировать все выделения"));
    exp.addEventListener("click", (e) => this.exportHighlights(e));
    const wrap = p.createDiv("er-toc-list");
    list.forEach((hl) => {
      const item = wrap.createDiv("er-hl-item");
      const dot = item.createDiv("er-hl-dot");
      dot.style.background = hlColorCss(hl.color);
      const body = item.createDiv("er-hl-body");
      const txt = body.createDiv("er-hl-text");
      txt.setText(hl.text.length > 160 ? hl.text.slice(0, 160) + "…" : hl.text);
      if (hl.comment) body.createDiv("er-hl-comment").setText(hl.comment);
      const showHlMenu = (e) => {
        e.preventDefault();
        e.stopPropagation();
        if (!this.file) return;
        const menu = new Menu();
        menu.addItem((it) => it.setTitle(__ertr("Создать заметку")).setIcon("file-plus").onClick(() => {
          createNoteFromSelection(this.app, this.plugin, hl.text, this.file, { extra: hlCommentMd(hl), color: hl.color, hl });
        }));
        menu.addItem((it) => it.setTitle(__ertr("Текстом в заметку книги")).setIcon("text-quote").onClick(() => {
          sendQuoteToBookNote(this, hl);
        }));
        menu.showAtMouseEvent(e);
      };
      const more = item.createDiv("er-hl-more");
      svgIcon(more, "more");
      more.setAttribute("aria-label", __ertr("Ещё"));
      more.addEventListener("click", showHlMenu);
      const del = item.createDiv("er-hl-del");
      svgIcon(del, "trash");
      del.setAttribute("aria-label", __ertr("Удалить"));
      del.addEventListener("click", (e) => {
        e.stopPropagation();
        if (!this.file) return;
        this.plugin.removeHighlight(this.file.path, hl.id);
        this._unwrapHighlight(hl.id);
        this.buildHlPanel();
      });
      item.addEventListener("click", () => this.goToHighlight(hl.id));
      item.addEventListener("contextmenu", showHlMenu);
    });
  }
  async onClose() {
    await persistCurrentReaderPosition(this);
    erHideVeil(this);
    let _a;
    stopReadingTimer(this);
    window.clearTimeout(this._immTimer);
    (_a = this._resizeObs) == null ? void 0 : _a.disconnect();
    window.clearTimeout(this._resizeTimer);
    window.clearTimeout(this._selTimer);
    window.clearTimeout(this._revealT);
    clearFoundIn(this);
  }
};
// ── Library categories ───────────────────────────────────────────────────────
// Categories come from the SUBFOLDERS books already live in — people organise
// their library on disk, so this needs no tagging or setup to be useful on day
// one. Books sitting directly in the books folder fall under "Без папки".
// The book's folder, relative to the books folder. "" when it sits directly in
// it. Used by the folder chips, which are a tree rather than a flat list.
function bookRelFolder(bookPath, booksFolder) {
  const base = erPath(booksFolder);
  let rel = erPath(bookPath);
  if (base && rel.startsWith(base + "/")) rel = rel.slice(base.length + 1);
  const i = rel.lastIndexOf("/");
  return i > 0 ? rel.slice(0, i) : "";
}
function bookCategoryOf(bookPath, booksFolder) {
  const base = erPath(booksFolder);
  let rel = erPath(bookPath);
  if (base && rel.startsWith(base + "/")) rel = rel.slice(base.length + 1);
  const i = rel.indexOf("/");
  return i > 0 ? rel.slice(0, i) : "";
}
// Reading state of a book, for the status chips.
function bookStatusOf(prog) {
  if (!prog || !prog.lastRead) return "new";
  const pct = typeof prog.percent === "number" ? prog.percent : 0;
  if (pct >= 98) return "done";
  if (pct > 0) return "reading";
  return "new";
}
// The chips shown above the grid: status groups first (what you're doing right
// now matters more than where a file sits), then one chip per folder. Empty
// groups are dropped so the bar only ever offers filters that lead somewhere.
function buildLibChips(files, booksFolder, getProgress, getTags, activeChip) {
  const statuses = { reading: 0, new: 0, done: 0 };
  const folders = /* @__PURE__ */ new Map();
  const tags = /* @__PURE__ */ new Map();
  for (const f of files) {
    statuses[bookStatusOf(getProgress(f.path))]++;
    const cat = bookCategoryOf(f.path, booksFolder);
    folders.set(cat, (folders.get(cat) || 0) + 1);
    for (const t of (getTags ? getTags(f.path) : [])) tags.set(t, (tags.get(t) || 0) + 1);
  }
  const chips = [{ id: "all", label: __ertr("Все"), count: files.length }];
  if (statuses.reading) chips.push({ id: "status:reading", label: __ertr("Читаю"), count: statuses.reading });
  if (statuses.new) chips.push({ id: "status:new", label: __ertr("Не начатые"), count: statuses.new });
  if (statuses.done) chips.push({ id: "status:done", label: __ertr("Прочитано"), count: statuses.done });
  // Reader-assigned categories come before folders: they were chosen on purpose,
  // whereas the folder is just wherever the file happens to sit.
  for (const [t, n] of [...tags.entries()].sort((a, b) => a[0].localeCompare(b[0], "ru"))) {
    chips.push({ id: `tag:${t}`, label: t, count: n });
  }
  const named = [...folders.entries()].filter(([c]) => c).sort((a, b) => a[0].localeCompare(b[0], "ru"));
  // Subfolders of whichever folder is open, so a deep library can be walked
  // instead of only sliced at the top level. Counted the same way, and only
  // when there is more than one — a single child chip just repeats its parent.
  const openFolder = activeChip && activeChip.startsWith("folder:") ? activeChip.slice(7) : null;
  const subs = /* @__PURE__ */ new Map();
  if (openFolder) {
    for (const f of files) {
      const rel = bookRelFolder(f.path, booksFolder);
      if (rel !== openFolder && rel.startsWith(openFolder + "/")) {
        const next = openFolder + "/" + rel.slice(openFolder.length + 1).split("/")[0];
        subs.set(next, (subs.get(next) || 0) + 1);
      }
    }
  }
  // A lone folder chip would just duplicate "Все" — only show folders when they
  // actually divide the library.
  if (named.length > 1 || (named.length === 1 && folders.has(""))) {
    for (const [cat, n] of named) {
      chips.push({ id: `folder:${cat}`, label: cat, count: n });
      // The open folder's children slot in directly beneath it, labelled with
      // only their own name so the row does not fill with repeated prefixes.
      if (openFolder === cat && subs.size > 1) {
        for (const [sub, sn] of [...subs.entries()].sort((a, b) => a[0].localeCompare(b[0], "ru"))) {
          chips.push({ id: `folder:${sub}`, label: "└ " + sub.slice(cat.length + 1), count: sn, sub: true });
        }
      }
    }
    if (folders.get("")) chips.push({ id: "folder:", label: __ertr("Без папки"), count: folders.get("") });
  }
  return chips;
}
// Apply the active chip + the search box.
function filterLibBooks(files, chipId, query, booksFolder, getProgress, getTags) {
  const needle = (query || "").trim().toLowerCase();
  return files.filter((f) => {
    if (needle && !f.basename.toLowerCase().includes(needle)) return false;
    if (!chipId || chipId === "all") return true;
    if (chipId.startsWith("status:")) return bookStatusOf(getProgress(f.path)) === chipId.slice(7);
    if (chipId.startsWith("folder:")) {
      // Prefix, not equality: choosing "История" should also show the books in
      // "История/Древний мир". A reader asked for exactly this — folders with
      // everything nested inside them.
      const want = chipId.slice(7);
      const have = bookRelFolder(f.path, booksFolder);
      return want === "" ? have === "" : (have === want || have.startsWith(want + "/"));
    }
    if (chipId.startsWith("tag:")) return (getTags ? getTags(f.path) : []).includes(chipId.slice(4));
    return true;
  });
}
// Categories a reader has assigned to a book (always an array, never undefined).
function bookTagsOf(settings, bookPath) {
  const m = (settings && settings.bookTags) || {};
  const v = m[bookPath];
  return Array.isArray(v) ? v.filter(Boolean) : [];
}
// Every category used anywhere, for the "pick or type" dropdown.
function allBookTags(settings) {
  const m = (settings && settings.bookTags) || {};
  const set = /* @__PURE__ */ new Set();
  for (const k of Object.keys(m)) for (const t of (Array.isArray(m[k]) ? m[k] : [])) if (t) set.add(t);
  return [...set].sort((a, b) => a.localeCompare(b, "ru"));
}
// "Психология, Бизнес" → ["Психология","Бизнес"]; also accepts #hashtags.
function parseBookTags(raw) {
  return String(raw || "")
    .split(/[,;\n]+/)
    .map((t) => t.trim().replace(/^#+/, "").trim())
    .filter(Boolean)
    .filter((t, i, a) => a.indexOf(t) === i);
}
const LibraryModal = class extends Modal {
  constructor(app, plugin) {
    super(app);
    this.plugin = plugin;
  }
  async onOpen() {
    const { contentEl, modalEl } = this;
    // The class goes on the CONTAINER as well as the dialog. Every sizing rule
    // in the stylesheet is written as `.er-modal-lib .modal` — a descendant
    // selector — and with the class only on modalEl (which IS `.modal`) not one
    // of them ever matched: the library kept Obsidian's default dialog size, so
    // it never went full-bleed on a phone and never took the wide desktop size
    // either. As a view the class already sits on the container, which is why
    // the same stylesheet behaved differently there.
    this.containerEl.addClass("er-modal-lib");
    modalEl.addClass("er-modal-lib");
    contentEl.addClass("er-lib");
    // No status-bar measurement here: the library is a leaf on every platform
    // now, and a leaf's edges belong to Obsidian.
    const t = erLibTheme(this.plugin.settings);
    modalEl.style.setProperty("--er-lib-bg", t.bg);
    modalEl.style.setProperty("--er-lib-text", t.text);
    modalEl.style.setProperty("--er-lib-card", t.ui);
    modalEl.style.setProperty("--er-lib-border", t.border);
    modalEl.style.setProperty("--er-lib-accent", t.accent);
    modalEl.style.setProperty("--er-lib-muted", t.muted);
    const hdr = contentEl.createDiv("er-lib-hdr");
    const headline = hdr.createDiv("er-lib-headline");
    const brand = headline.createDiv("er-lib-brand");
    const logo = brand.createDiv("er-lib-logo");
    svgIcon(logo, "qiaomu-library");
    const hw = brand.createDiv("er-lib-hw");
    hw.createDiv("er-lib-title").setText(__ertr("\u0411\u0438\u0431\u043B\u0438\u043E\u0442\u0435\u043A\u0430"));
    hw.createDiv("er-lib-sub").setText("Qiaomu Book Reader");
    // Primary action: import .pdf / .epub / .fb2 into the books folder. Sits at the
    // head of the right-hand cluster, away from the cover-size +/- so the two "+"
    // never read as one control. Files can also be dropped anywhere on the modal.
    const addBtn = headline.createDiv("er-lib-add");
    addBtn.setAttribute("role", "button");
    addBtn.setAttribute("tabindex", "0");
    addBtn.setAttribute("aria-label", __ertr("\u0414\u043E\u0431\u0430\u0432\u0438\u0442\u044C \u043A\u043D\u0438\u0433\u0443"));
    svgIcon(addBtn, "plus");
    addBtn.createSpan({ cls: "er-lib-add-label", text: __ertr("\u0414\u043E\u0431\u0430\u0432\u0438\u0442\u044C \u043A\u043D\u0438\u0433\u0443") });
    const doPick = () => this._pickBooks();
    addBtn.addEventListener("click", doPick);
    addBtn.addEventListener("keydown", (e) => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); doPick(); } });
    this._setupDropZone();
    const tools = hdr.createDiv("er-lib-tools");
    const search = tools.createDiv("er-lib-search");
    const sIc = search.createDiv("er-lib-search-ic");
    svgIcon(sIc, "search");
    const input = search.createEl("input", { cls: "er-lib-search-input", attr: { type: "text", placeholder: __ertr("\u041F\u043E\u0438\u0441\u043A \u043A\u043D\u0438\u0433\u0438\u2026"), spellcheck: "false" } });
    const count = tools.createDiv("er-lib-count");
    // Manual size control — adjust how big the covers are, live.
    const sizeWrap = tools.createDiv("er-lib-size");
    const applySize = () => {
      const px = Math.max(110, Math.min(300, this.plugin.settings.libCoverSize || 176));
      if (this._grid) this._grid.style.gridTemplateColumns = `repeat(auto-fill,minmax(${px}px,1fr))`;
    };
    const mkSz = (label, d, aria) => {
      const b = sizeWrap.createDiv("er-lib-szbtn");
      b.setText(label);
      b.setAttribute("aria-label", aria);
      b.addEventListener("click", async () => {
        this.plugin.settings.libCoverSize = Math.max(110, Math.min(300, (this.plugin.settings.libCoverSize || 176) + d));
        applySize();
        window.requestAnimationFrame(() => this._sizeCovers());
        await this.plugin.saveAll();
      });
    };
    mkSz("−", -28, __ertr("Меньше обложки"));
    mkSz("+", 28, __ertr("Больше обложки"));
    await this.plugin.refreshProgress();
    const folder = erPath(this.plugin.settings.booksFolder);
    // Match on "<folder>/" — a bare startsWith would also pull in a sibling
    // folder that merely shares the prefix (e.g. "Books" catching "Books archive").
    const prefix = folder ? folder + "/" : "";
    const files = this.app.vault.getFiles().filter(
      (f) => (f.extension === "epub" || f.extension === "pdf" || f.extension === "fb2") && (prefix === "" || f.path.startsWith(prefix))
    );
    if (!files.length) {
      const e = contentEl.createDiv("er-lib-empty");
      const emptyIcon = e.createDiv("er-lib-empty-icon");
      svgIcon(emptyIcon, "qiaomu-library");
      e.createDiv("er-lib-empty-text").setText(__ertr("\u041D\u0435\u0442 \u043A\u043D\u0438\u0433"));
      e.createDiv("er-lib-empty-hint").setText(folder || __ertr("\u0412\u0441\u0435 \u043F\u0430\u043F\u043A\u0438 vault"));
      // Give an empty shelf a direct way to fill itself, not just the header button.
      const cta = e.createDiv("er-lib-empty-add");
      cta.setAttribute("role", "button");
      cta.setAttribute("tabindex", "0");
      svgIcon(cta, "plus");
      cta.createSpan({ text: __ertr("\u0414\u043E\u0431\u0430\u0432\u0438\u0442\u044C \u043A\u043D\u0438\u0433\u0443") });
      const goCta = () => this._pickBooks();
      cta.addEventListener("click", goCta);
      cta.addEventListener("keydown", (ev) => { if (ev.key === "Enter" || ev.key === " ") { ev.preventDefault(); goCta(); } });
      return;
    }
    files.sort((a, b) => {
      let _a, _b, _c, _d;
      const pa = (_b = (_a = this.plugin.getProgress(a.path)) == null ? void 0 : _a.lastRead) != null ? _b : 0;
      const pb = (_d = (_c = this.plugin.getProgress(b.path)) == null ? void 0 : _c.lastRead) != null ? _d : 0;
      return pb !== pa ? pb - pa : a.basename.localeCompare(b.basename, "ru");
    });
    // Category chips — folders the books live in, plus reading-state groups.
    const chipsRow = contentEl.createDiv("er-lib-chips");
    const grid = contentEl.createDiv("er-lib-grid");
    const plural = (n) => {
      const a = Math.abs(n) % 100, b = a % 10;
      if (a > 10 && a < 20) return __ertr("\u043A\u043D\u0438\u0433");
      if (b > 1 && b < 5) return __ertr("\u043A\u043D\u0438\u0433\u0438");
      if (b === 1) return __ertr("\u043A\u043D\u0438\u0433\u0430");
      return __ertr("\u043A\u043D\u0438\u0433");
    };
    this._grid = grid;
    applySize();
    const getProg = (p) => this.plugin.getProgress(p);
    const getTags = (p) => bookTagsOf(this.plugin.settings, p);
    // Remember the last chip across sessions, but fall back to "\u0412\u0441\u0435" if that
    // category no longer exists (folder renamed, last book in it finished\u2026).
    let active = this.plugin.settings.libCategory || "all";
    // The chip list depends on which chip is active \u2014 an open folder shows its
    // subfolders \u2014 so it is built with the remembered choice in hand, then the
    // choice is validated against what actually came back.
    let chips = buildLibChips(files, folder, getProg, getTags, active);
    if (!chips.some((c) => c.id === active)) {
      active = "all";
      chips = buildLibChips(files, folder, getProg, getTags, active);
    }
    const render = (q) => {
      grid.empty();
      const shown = filterLibBooks(files, active, q, folder, getProg, getTags);
      count.setText(`${shown.length} ${plural(shown.length)}`);
      if (!shown.length) {
        grid.createDiv("er-lib-noresult").setText(__ertr("\u041D\u0438\u0447\u0435\u0433\u043E \u043D\u0435 \u043D\u0430\u0439\u0434\u0435\u043D\u043E"));
        return;
      }
      for (const f of shown) this.renderCard(grid, f);
      // Re-check sizing across the modal's open animation (themes animate it, so an
      // early measurement is wrong) \u2014 the smart fallback only acts if needed.
      window.requestAnimationFrame(() => this._sizeCovers());
      [120, 350, 650].forEach((t) => window.setTimeout(() => this._sizeCovers(), t));
    };
    // The row is rebuilt on every pick, not just re-highlighted: opening a
    // folder adds its subfolders to the row, and leaving it takes them away.
    const drawChips = () => {
      chips = buildLibChips(files, folder, getProg, getTags, active);
      chipsRow.empty();
      // Only worth a chip bar when there is more than one thing to choose.
      if (chips.length <= 1) { chipsRow.addClass("er-hidden"); return; }
      chipsRow.removeClass("er-hidden");
      chips.forEach((c) => {
        const el = chipsRow.createDiv("er-lib-chip");
        if (c.sub) el.addClass("er-lib-chip-sub");
        el.createSpan({ text: c.label });
        el.createSpan({ cls: "er-lib-chip-n", text: String(c.count) });
        if (c.id === active) el.addClass("er-lib-chip-on");
        el.setAttribute("role", "button");
        el.setAttribute("tabindex", "0");
        const pick = async () => {
          active = c.id;
          this.plugin.settings.libCategory = c.id;
          await this.plugin._saveLocalData();
          drawChips();
          render(input.value);
        };
        el.addEventListener("click", pick);
        el.addEventListener("keydown", (e) => {
          if (e.key === "Enter" || e.key === " ") { e.preventDefault(); pick(); }
        });
      });
    };
    drawChips();
    input.addEventListener("input", () => render(input.value));
    render("");
    this._coverResizeObs = new ResizeObserver(() => this._sizeCovers());
    this._coverResizeObs.observe(grid);
    erAutoFocus(input, 60);
    erBlurOnTapOutside(this.contentEl, input);
  }
  // Open the OS file picker for the three supported formats, then import.
  _pickBooks() {
    const doc = docOf(this.contentEl);
    const inp = doc.createElement("input");
    inp.type = "file";
    inp.accept = ".pdf,.epub,.fb2,application/pdf,application/epub+zip";
    inp.multiple = true;
    inp.addClass("er-hidden");
    inp.addEventListener("change", async () => {
      const files = Array.from(inp.files || []);
      inp.remove();
      await this._importBooks(files);
    });
    doc.body.appendChild(inp);
    inp.click();
  }
  // Drag & drop OS files anywhere on the modal. Bound once to modalEl (which
  // survives a grid refresh), with a dashed overlay shown only while dragging.
  _setupDropZone() {
    if (this._dropBound) return;
    this._dropBound = true;
    const host = this.modalEl;
    const overlay = host.createDiv("er-lib-drop");
    const inner = overlay.createDiv("er-lib-drop-inner");
    svgIcon(inner, "plus");
    inner.createSpan({ text: __ertr("Отпустите файлы, чтобы добавить их в библиотеку") });
    let depth = 0;
    const hasFiles = (e) => !!e.dataTransfer && Array.from(e.dataTransfer.types || []).includes("Files");
    host.addEventListener("dragenter", (e) => { if (!hasFiles(e)) return; e.preventDefault(); depth++; host.addClass("er-lib-dragging"); });
    host.addEventListener("dragover", (e) => { if (!hasFiles(e)) return; e.preventDefault(); e.dataTransfer.dropEffect = "copy"; });
    host.addEventListener("dragleave", (e) => { if (!hasFiles(e)) return; depth = Math.max(0, depth - 1); if (!depth) host.removeClass("er-lib-dragging"); });
    host.addEventListener("drop", async (e) => {
      if (!hasFiles(e)) return;
      e.preventDefault();
      depth = 0;
      host.removeClass("er-lib-dragging");
      // Drop a FOLDER and `files` contains an entry that is not a file at all.
      // Asking it for its bytes either rejects or, on Windows, blocks the whole
      // renderer — which is the likeliest explanation for "drag and drop makes
      // Obsidian crash". The DataTransfer items know which is which, so ask
      // them and keep only real files.
      const items = Array.from(e.dataTransfer.items || []);
      const dropped = Array.from(e.dataTransfer.files || []);
      let usable = dropped;
      if (items.length === dropped.length && typeof items[0]?.webkitGetAsEntry === "function") {
        usable = dropped.filter((f, i) => {
          const entry = items[i].webkitGetAsEntry();
          return !entry || entry.isFile;
        });
        const folders = dropped.length - usable.length;
        if (folders) new Notice(__ertr("Папки пропущены — перетащите сами файлы книг ({0})", folders));
      }
      await this._importBooks(usable);
    });
  }
  // Where to drop an imported book. The configured "books folder" wins; if it is
  // empty (the common case), land the file where most books already live so it
  // joins the existing library instead of the vault root. Only falls back to root
  // when the vault has no books yet.
  _targetDir() {
    const set = erPath(this.plugin.settings.booksFolder || "");
    if (set) return set;
    const exts = ["pdf", "epub", "fb2"];
    const counts = new Map();
    for (const f of this.app.vault.getFiles()) {
      if (!exts.includes(f.extension)) continue;
      const dir = f.parent && f.parent.path && f.parent.path !== "/" ? f.parent.path : "";
      counts.set(dir, (counts.get(dir) || 0) + 1);
    }
    let best = "", bestN = -1;
    for (const [dir, n] of counts) if (n > bestN) { best = dir; bestN = n; }
    return best;
  }
  // A collision-free destination path inside the books folder (or vault root),
  // sanitised for the filesystem and suffixed " (1)", " (2)"… if the name is taken.
  _freeBookPath(dir, name) {
    const clean = (name || "book").replace(/[\\/:*?"<>|\n\r\t]/g, "_").trim() || "book";
    const dot = clean.lastIndexOf(".");
    const base = dot > 0 ? clean.slice(0, dot) : clean;
    const ext = dot > 0 ? clean.slice(dot) : "";
    // Every constructed vault path goes through normalizePath (erPath). This one
    // was the exception, and it is the one that matters most: it is built from a
    // filename the operating system handed over, which can carry a trailing
    // space, a doubled slash or decomposed Unicode (macOS hands over NFD, the
    // vault stores NFC). Comparing an un-normalised path against the vault's
    // index can miss an existing file, and writing one can land somewhere other
    // than where it was checked for.
    const join = (b) => erPath((dir ? dir + "/" : "") + b + ext);
    let p = join(base), i = 1;
    while (this.app.vault.getAbstractFileByPath(p)) p = join(`${base} (${i++})`);
    return p;
  }
  // Import a list of picked/dropped File objects: keep only supported formats,
  // write each into the books folder as a real vault file, then refresh the grid.
  async _importBooks(fileList) {
    const exts = ["pdf", "epub", "fb2"];
    const all = fileList || [];
    // Take the extension off the END of the name rather than off the first dot,
    // and tolerate the stray whitespace some file managers hand over, so a name
    // like "The Art of War (2nd ed.).pdf " is still recognised as a PDF. The
    // MIME type is a second opinion for the two formats that have one.
    const extOf = (f) => {
      // `name` is normally there, but Electron also exposes the full `path`, and
      // a File that arrives without a usable name would otherwise be rejected as
      // "unsupported format" while sitting right there on disk.
      const raw = (f && f.name) || (f && f.path ? String(f.path).split(/[\\/]/).pop() : "");
      const n = String(raw || "").trim().replace(/[.\s]+$/, "");
      const dot = n.lastIndexOf(".");
      const e = dot > 0 ? n.slice(dot + 1).toLowerCase() : "";
      if (exts.includes(e)) return e;
      const mime = String((f && f.type) || "").toLowerCase();
      if (mime === "application/pdf") return "pdf";
      if (mime === "application/epub+zip") return "epub";
      return e;
    };
    const picked = all.filter((f) => exts.includes(extOf(f)));
    const rejected = all.filter((f) => !exts.includes(extOf(f)));
    if (rejected.length) {
      // Say WHAT was rejected and what the reader was seen as, not just that
      // something was. A reader reported files being refused as "unsupported"
      // that plainly were supported, and the old message gave nothing to go on —
      // no name, no extension, nothing to put in a bug report.
      const detail = rejected.slice(0, 5).map((f) => {
        const nm = (f && f.name) || (f && f.path) || "?";
        return `${nm} [${extOf(f) || "—"}${f && f.type ? ", " + f.type : ""}]`;
      }).join("; ");
      console.warn("Book Reader: rejected on import —", rejected.map((f) => ({
        name: f && f.name, path: f && f.path, type: f && f.type, size: f && f.size, seenAs: extOf(f),
      })));
      new Notice(__ertr("Не подошли ({0}): {1}. Поддерживаются PDF, EPUB и FB2.", rejected.length, detail), 10000);
    }
    if (!picked.length) {
      if (!rejected.length) new Notice(__ertr("Файлы не выбраны"));
      return;
    }
    const dir = this._targetDir();
    if (dir && !this.app.vault.getAbstractFileByPath(dir)) {
      await this.app.vault.createFolder(dir).catch(() => {});
    }
    let ok = 0;
    const errors = [];
    for (const f of picked) {
      try {
        const buf = await f.arrayBuffer();
        await this.app.vault.createBinary(this._freeBookPath(dir, f.name), buf);
        ok++;
      } catch (err) {
        console.warn("Book Reader: could not import", f && f.name, err);
        errors.push(f.name);
      }
    }
    if (ok) new Notice(__ertr("Добавлено книг: {0}", ok) + (rejected.length ? " · " + __ertr("пропущено: {0}", rejected.length) : ""));
    if (errors.length) new Notice(__ertr("Не удалось добавить: {0}", errors.join(", ")));
    if (ok) this._refresh();
  }
  // Rebuild the library in place after books were added, without a modal flash.
  _refresh() {
    if (this._coverResizeObs) { try { this._coverResizeObs.disconnect(); } catch { /* optional step; a failure here must not interrupt reading */ } }
    this.contentEl.empty();
    this.onOpen();
  }
  _sizeCovers() {
    if (!this._grid) return;
    // The cover div gets its 2:3 box from CSS `aspect-ratio:2/3`. This is only a
    // FALLBACK: if a webview ever ignores aspect-ratio (height comes out far from
    // 2:3), pin an explicit px height; otherwise leave the CSS value alone so a
    // mis-timed early measurement can't squash a correct cover.
    this._grid.querySelectorAll(".er-lib-cover").forEach((c) => {
      const w = c.offsetWidth;
      if (!w) return;
      const h = c.offsetHeight;
      if (h < w * 1.35 || h > w * 1.65) c.style.setProperty("height", Math.round(w * 1.5) + "px", "important");
      else c.style.removeProperty("height");
    });
  }
  renderCard(grid, file) {
    let _a, _b;
    const prog = this.plugin.getProgress(file.path);
    const pct = (_a = prog == null ? void 0 : prog.percent) != null ? _a : 0;
    const card = grid.createDiv("er-lib-card");
    const cover = card.createDiv("er-lib-cover");
    const fits = ((_b = this.plugin.settings.coverFits) != null ? _b : (this.plugin.settings.coverFits = {}));
    if (fits[file.path] === "fill") cover.addClass("er-fit-fill");
    const ph = cover.createDiv("er-lib-ph");
    ph.createDiv("er-lib-ph-ext").setText(file.extension.toUpperCase());
    ph.createDiv("er-lib-ph-init").setText(file.basename.slice(0, 2).toUpperCase());
    this.loadThumb(file, cover, ph);
    // Hover button: switch this cover between "\u0432\u043F\u0438\u0441\u0430\u0442\u044C" (whole cover visible,
    // contain) and "\u0437\u0430\u043F\u043E\u043B\u043D\u0438\u0442\u044C" (fill the box, cover). Applied as inline
    // background-size so it survives theme CSS.
    const fitBtn = cover.createDiv("er-lib-fitbtn");
    fitBtn.setAttribute("aria-label", __ertr("\u0412\u0438\u0434 \u043E\u0431\u043B\u043E\u0436\u043A\u0438"));
    const applyFit = () => {
      const fill = cover.hasClass("er-fit-fill");
      cover.style.setProperty("background-size", fill ? "cover" : "contain", "important");
      svgIcon(fitBtn, fill ? "cover-fit" : "cover-fill");
    };
    applyFit();
    fitBtn.addEventListener("click", (e) => {
      e.stopPropagation();
      const nowFill = !cover.hasClass("er-fit-fill");
      cover.toggleClass("er-fit-fill", nowFill);
      if (nowFill) fits[file.path] = "fill"; else delete fits[file.path];
      applyFit();
      this.plugin.saveAll();
    });
    if (pct > 0) {
      const s = cover.createDiv("er-lib-strip");
      s.createDiv("er-lib-strip-fill").style.width = `${pct}%`;
    }
    const info = card.createDiv("er-lib-info");
    info.createDiv("er-lib-book-title").setText(file.basename);
    const meta = info.createDiv("er-lib-book-meta");
    if (prog == null ? void 0 : prog.lastRead) {
      meta.setText(`${pct}% \xB7 ${new Date(prog.lastRead).toLocaleDateString(__erLocale(), { day: "numeric", month: "short" })}`);
    } else {
      meta.setText(__ertr("\u041D\u0435 \u0447\u0438\u0442\u0430\u043B\u0430\u0441\u044C"));
    }
    // Действия с книгой. Кнопка нужна отдельно от правой кнопки мыши: на
    // телефоне правой кнопки нет, а удалять книгу с телефона просили тоже.
    const bookMenu = (e) => {
      e.preventDefault();
      e.stopPropagation();
      const menu = new Menu();
      // «Читать» тут не нужно: по карточке и так открывается книга, а меню
      // и без того длинное — в него добавляет свои пункты сам Obsidian.
      addBookFileMenu(this.app, menu, file);
      menu.addSeparator();
      menu.addItem((it) => it.setTitle(__ertr("Удалить книгу")).setIcon("trash").onClick(() => {
        deleteBookFromVault(this.app, this.plugin, file, () => this._refresh());
      }));
      menu.showAtMouseEvent(e);
    };
    card.addEventListener("contextmenu", bookMenu);
    const moreBtn = cover.createDiv("er-lib-morebtn");
    moreBtn.setAttribute("aria-label", __ertr("Действия с книгой"));
    svgIcon(moreBtn, "more");
    moreBtn.addEventListener("click", bookMenu);
    card.addEventListener("click", () => {
      this.close();
      this.plugin.openFile(file);
    });
  }
  async loadThumb(file, coverEl, ph) {
    // A cover named in the book's note wins over everything.
    //
    // Asked for plainly: "хотелось бы для каждой книги выбирать обложку через
    // метаданные книжной заметки — по дефолту та, что в документе, а если в
    // заметке есть свойство с обложкой, брать её. Я просто люблю когда всё
    // красиво, а у некоторых книг обложки оставляют желать лучшего." Читается
    // свойство `cover` (или `обложка`) — ссылка, путь к файлу в хранилище или
    // вики-ссылка. Ничего не кэшируется: правка свойства видна сразу.
    const own = this.coverFromBookNote(file);
    if (own) { this.showImg(coverEl, ph, own); return; }
    // Cached cover → show immediately (this is the common path once generated).
    if (this.plugin.thumbCache[file.path]) {
      this.showImg(coverEl, ph, this.plugin.thumbCache[file.path]);
      return;
    }
    // Generate uncached covers ONE AT A TIME through a shared promise chain.
    // Firing a dozen `makePdfThumb`s at once (each loads a whole PDF — some are
    // 30–75 MB — and each used to call saveAll()) overloaded the single PDF
    // worker and raced a dozen concurrent data.json writes, which left the whole
    // library with blank covers when many books were added. Serialising fixes it.
    this._thumbQueue = (this._thumbQueue || Promise.resolve()).then(async () => {
      if (this.plugin.thumbCache[file.path]) { this.showImg(coverEl, ph, this.plugin.thumbCache[file.path]); return; }
      try {
        const url = file.extension === "pdf" ? await this.makePdfThumb(file)
          : file.extension === "fb2" ? await this.makeFb2Thumb(file)
          : await this.makeEpubThumb(file);
        if (!url) return;
        this.plugin.thumbCache[file.path] = url;
        this._thumbDirty = true;
        this.showImg(coverEl, ph, url);
      } catch (e) {
        console.warn("Book Reader: cover failed for", file.path, e);
      }
    }).then(() => {
      // Persist once the chain goes idle (debounced), not after every single
      // cover — avoids racing/oversized writes to data.json.
      window.clearTimeout(this._thumbSaveT);
      this._thumbSaveT = window.setTimeout(() => { if (this._thumbDirty) { this._thumbDirty = false; this.plugin._saveThumbCache(); } }, 800);
    });
    return this._thumbQueue;
  }
  // The cover a reader chose in the book's note, or nothing.
  //
  // Three shapes are accepted, because all three are what people actually write
  // in frontmatter: a plain URL, a path to an image inside the vault, and a
  // [[wiki link]]. Anything that does not resolve simply falls through to the
  // cover embedded in the book — the point is to override it, never to break it.
  coverFromBookNote(file) {
    try {
      const name = bookNoteLinkFor(this.plugin, file);
      if (!name) return null;
      const note = resolveBookNote(this.app, name);
      if (!note) return null;
      const fm = this.app.metadataCache.getFileCache(note)?.frontmatter;
      if (!fm) return null;
      const raw = fm.cover ?? fm.обложка ?? fm.Cover ?? fm.Обложка;
      const val = String(Array.isArray(raw) ? raw[0] : (raw ?? "")).trim();
      if (!val) return null;
      if (/^https?:\/\//i.test(val)) return val;
      const inner = (val.match(/^!?\[\[([^\]|#]+)/) || [])[1] || val;
      const img = this.app.metadataCache.getFirstLinkpathDest(inner.trim(), note.path)
        || this.app.vault.getAbstractFileByPath(erPath(inner.trim()));
      return img instanceof TFile ? this.app.vault.getResourcePath(img) : null;
    } catch { return null; }
  }
  showImg(coverEl, ph, src) {
    if (!src) return;
    ph.addClass("er-hidden");
    // Paint the cover as the DIV's background-image (no <img> element). Themes
    // can't restyle a div's background the way they hijack `img`, so the cover
    // always fills the 2:3 box (height pinned in px by _sizeCovers). "background-
    // position:center top" keeps the title visible if the art is taller than 2:3.
    coverEl.style.setProperty("background-image", `url("${src.replace(/"/g, '\\"')}")`, "important");
    coverEl.addClass("er-cover-img");
    // "contain" = the WHOLE cover is always visible inside the 2:3 box (никогда
    // не обрезается), with the neutral box colour as a thin letterbox if the art
    // isn't exactly 2:3. "fill" mode (the toggle) switches to cover.
    coverEl.style.setProperty("background-size", coverEl.hasClass("er-fit-fill") ? "cover" : "contain", "important");
    coverEl.addClass("er-has-cover");
  }
  async makePdfThumb(file) {
    await setupWorker(this.app);
    const buf = await this.app.vault.readBinary(file);
    const doc = await pdfjsLib.getDocument({
      data: buf,
      // Книга — чужой файл. У pdf.js есть известная дыра, где специально
      // собранный шрифт выполняет свой код через eval; отключение eval —
      // штатное лечение от неё (CVE-2024-4367). На вёрстку не влияет.
      isEvalSupported: false,
    }).promise;
    const page = await doc.getPage(1);
    // Render crisp (~520px wide), flattened onto white, capped so the cached
    // data-URL stays small. Old version used scale 0.5 \u2192 blurry thumbnails.
    const base = page.getViewport({ scale: 1 });
    const scale = Math.min(2.5, Math.max(1, 520 / (base.width || 400)));
    const vp = page.getViewport({ scale });
    const cv = document.createElement("canvas");
    cv.width = Math.ceil(vp.width);
    cv.height = Math.ceil(vp.height);
    const ctx = cv.getContext("2d");
    ctx.fillStyle = "#ffffff";
    ctx.fillRect(0, 0, cv.width, cv.height);
    await page.render({ canvasContext: ctx, viewport: vp }).promise;
    const url = cv.toDataURL("image/jpeg", 0.85);
    doc.destroy();
    return url;
  }
  // FB2 keeps its cover as a base64 <binary>, so the "thumbnail" is already a
  // data URL — no rendering needed. Falls back to the first image in the file
  // when the description declares no coverpage.
  async makeFb2Thumb(file) {
    const buf = await this.app.vault.readBinary(file);
    const bytes = new Uint8Array(buf);
    if (bytes[0] === 0x50 && bytes[1] === 0x4B) throw new Error("fb2 is zipped");
    const doc = new DOMParser().parseFromString(decodeFb2(buf), "application/xml");
    const cp = doc.getElementsByTagName("coverpage")[0];
    const img = cp && cp.getElementsByTagName("image")[0];
    const id = img ? fb2Href(img) : "";
    const bins = Array.from(doc.getElementsByTagName("binary"));
    const bin = (id && bins.find((b) => b.getAttribute("id") === id)) || bins[0];
    if (!bin) throw new Error("no cover");
    const data = (bin.textContent || "").replace(/\s+/g, "");
    if (!data) throw new Error("no cover");
    return `data:${bin.getAttribute("content-type") || "image/jpeg"};base64,${data}`;
  }
  async makeEpubThumb(file) {
    const buf = await this.app.vault.readBinary(file);
    const book = ePub(buf);
    await book.ready;
    // Read the cover straight out of the unpacked EPUB.
    //
    // This used to go through book.coverUrl(), which hands back a blob: URL that
    // then had to be read with fetch(). Nothing left the device either way — the
    // blob was made from the file already in memory — but a fetch() sitting in a
    // plugin is a thing reviewers have to stop and check, and requestUrl() can't
    // read blob: URLs. Asking the archive directly removes the question: there is
    // no URL and no request, just the bytes epub.js already has.
    const coverPath = await book.loaded.cover;
    if (!coverPath) { book.destroy(); throw new Error("no cover"); }
    const archive = book.archive;
    if (!archive || typeof archive.getBase64 !== "function") {
      book.destroy();
      throw new Error("epub archive unavailable");
    }
    const dataUrl = await archive.getBase64(coverPath);
    book.destroy();
    if (!dataUrl) throw new Error("no cover");
    return dataUrl;
  }
  onClose() {
    // Flush any covers generated this session before the library closes.
    window.clearTimeout(this._thumbSaveT);
    if (this._thumbDirty) { this._thumbDirty = false; this.plugin.saveAll(); }
    this._coverResizeObs?.disconnect();
    this.contentEl.empty();
  }
};
// ── Mobile full-screen reader modal ───────────────────────────────────────────
// ── Mobile full-screen reader modal (section-based, no CSS columns) ──────────
// The library as a TAB, not a dialog.
//
// A modal is capped by Obsidian's own sizing and cannot leave the main window.
// A leaf can: it docks, splits, resizes with the window, and — the thing that
// was actually asked for — Obsidian can move it into its own OS window, where
// it can be maximised like any other. Same code draws both: the drawing never
// cared whether it lived in a dialog, only that it had an element to draw into
// and a way to close itself.
const LIB_VIEW_TYPE = "elton-library";
const LibraryView = class extends ItemView {
  constructor(leaf, plugin) {
    super(leaf);
    this.plugin = plugin;
  }
  getViewType() { return LIB_VIEW_TYPE; }
  getDisplayText() { return __ertr("Библиотека"); }
  getIcon() { return "library"; }
  async onOpen() {
    // The two things the library's drawing expects from a dialog. `modalEl` is
    // only ever used as the host for the drag-and-drop overlay.
    this.modalEl = this.containerEl;
    this.containerEl.addClass("er-modal-lib", "er-lib-as-view");
    await LibraryModal.prototype.onOpen.call(this);
  }
  // Opening a book closes the library when it is a dialog; as a tab there is
  // nothing to close, and detaching would take the book's own tab with it on a
  // narrow layout. Staying open is also simply more useful here.
  close() { /* a tab stays put */ }
  onClose() {
    if (this._coverResizeObs) { try { this._coverResizeObs.disconnect(); } catch { /* already gone */ } }
    this.contentEl.empty();
  }
};
// Everything the library draws lives on LibraryModal's prototype. Borrow it
// wholesale rather than duplicating 500 lines that would then drift apart.
for (const name of Object.getOwnPropertyNames(LibraryModal.prototype)) {
  if (["constructor", "onOpen", "onClose", "close"].includes(name)) continue;
  Object.defineProperty(LibraryView.prototype, name,
    Object.getOwnPropertyDescriptor(LibraryModal.prototype, name));
}
const ReaderModal = class extends Modal {
  constructor(app, plugin, file) {
    super(app);
    this.plugin  = plugin;
    this.file    = file;
    this.ext     = file.extension === "epub" ? "epub" : file.extension === "fb2" ? "fb2" : "pdf";
    // Mobile now uses the SAME horizontal page engine as the desktop view, so
    // you turn pages by swiping left/right (like a real book) instead of
    // scrolling down a long chapter.
    this.pager   = new Paginator();
    this.pager.onSpreadChange = (cur, tot) => {
      (this.updateUI || this._updateUI).call(this, cur, tot);
      if (this.file) this.plugin.saveProgress(this.file.path, cur, tot, this.pager.currentBlockIndex());
    };
    this.bookHtml = "";
    this.tocItems = [];
    this.panelOpen = null;
    this._pendingSel = null;
    this._editHlId = null;
  }
  async onOpen() {
    const { modalEl, contentEl } = this;
    // Let commands find the open mobile reader — it is a Modal, so it never
    // appears in getActiveViewOfType().
    this.plugin._openReaderModal = this;
    // Don't let Esc close the reader: it was yanking you out of the whole book
    // when you only meant to dismiss a zoomed image. Remove Obsidian's built-in
    // Esc→close handler from this modal's scope; the book is closed with the ←
    // button instead, and the image viewer is closed by ✕ / tapping outside.
    try {
      if (this.scope && Array.isArray(this.scope.keys)) {
        this.scope.keys = this.scope.keys.filter((k) => String(k && k.key).toLowerCase() !== "escape");
      }
    } catch { /* optional step; a failure here must not interrupt reading */ }
    modalEl.addClass("er-fullscreen-modal");
    // Also on the container: the mobile build gives it padding of its own, which
    // showed as grey bands down both sides of the book (8px, measured off the
    // screen). Only a rule aimed at the container can take that back.
    this.containerEl.addClass("er-fullscreen-container");
    contentEl.addClass("er-fullscreen-content");
    // Ручная подстройка под статус-бар: на некоторых Android-оболочках система
    // не сообщает высоту «шторки», и панель читалки уезжает под часы. Ноль —
    // ничего не меняет, отступ остаётся системным.
    const extraTop = Number(this.plugin.settings.mobileTopInset) || 0;
    if (extraTop > 0) contentEl.style.setProperty("--er-extra-top", extraTop + "px");
    // Take Obsidian's own ✕ out of the DOM, rather than styling it away.
    //
    // It floats in the window's top-right corner; our window fills the screen,
    // so on a phone it lands inside the status bar, on top of the battery. The
    // reader already has one way out (← in the top bar, and «Закрыть книгу» in
    // the ⋯ menu), so it is a duplicate as well as an eyesore.
    //
    // Three CSS selectors scoped to our own classes did not reach it — display,
    // visibility and pointer-events, all !important, and it stayed on screen
    // through a theme change too. Rather than guess at a fourth selector, walk
    // the DOM from OUR OWN container: whatever the mobile build nests it in, it
    // is inside there, and an element that is gone cannot be restyled back.
    // A single sweep at open was not enough — it was still on screen afterwards,
    // which means the button is either created later than onOpen or hangs off
    // something other than our container. So: sweep now, and keep watching for
    // as long as the book is open.
    //
    // What gets removed is narrow on purpose: our own dialog's button, and any
    // stray one that belongs to no dialog at all (the case a single sweep from
    // our container cannot see). A button inside SOME OTHER dialog is left
    // alone — the AI breakdown, the translator and the settings windows open on
    // top of the reader and must keep their way out.
    // BOTH class names. Obsidian 1.13 renamed this control: it is
    // `.modal-header-button.mod-raised.clickable-icon` now, and
    // `.modal-close-button` — the name every guide and every older plugin uses —
    // matches nothing. That is the whole story of why four rounds of CSS and a
    // DOM removal all failed: they were aimed at an element that no longer
    // exists. Read off the running app over the debugging port: one
    // `.modal-header-button` with a `lucide-x` icon inside our own modal, zero
    // `.modal-close-button` anywhere. The old name stays for older Obsidian.
    const CLOSE_BTNS = ".modal-close-button, .modal-header-button";
    const dropStrayCloses = (all) => {
      try {
        for (const b of docOf(modalEl).querySelectorAll(CLOSE_BTNS)) {
          const own = b.closest(".modal-container");
          // `all` is the sweep at open: the book is the only dialog on screen at
          // that instant, so everything goes. The previous version kept the ones
          // whose container was not the node we knew about — which is exactly the
          // case that survives if the mobile build nests the dialog differently,
          // and it did survive. Afterwards the rule tightens again.
          if (all || !own || own === this.containerEl) b.remove();
        }
      } catch { /* nothing to remove is a perfectly good outcome */ }
    };
    dropStrayCloses(true);
    // Wrapped, not passed straight in: a MutationObserver hands its callback the
    // list of records, which is truthy — the sweep-everything flag would have
    // been on for every mutation, and other dialogs would lose their ✕ too.
    this._closeWatch = new MutationObserver(() => dropStrayCloses(false));
    this._closeWatch.observe(docOf(modalEl).body, { childList: true, subtree: true });
    this._applyTheme();
    this._buildDOM();
    await this._loadBook();
    this._sessionSec = 0;
    this._running = false;
    this._goalNotified = this.plugin.getTodaySeconds() >= this.plugin.getGoalSeconds();
    updateGoalBar(this);
    updateTimerBtn(this);
    // Re-flow the pages when the viewport changes (e.g. phone rotation, keyboard).
    this._lastW = this.areaEl.clientWidth;
    this._resizeObs = new ResizeObserver(() => {
      window.clearTimeout(this._rsT);
      this._rsT = window.setTimeout(() => {
        // Rotation changes the strip (an iPhone has none in landscape). Settle it
        // first, then decide about re-flowing — the strip is part of the height
        // the columns are measured against.
        // (the status bar strip is pure CSS now — nothing to re-measure)
        const w = this.areaEl ? this.areaEl.clientWidth : 0;
        if (w && Math.abs(w - (this._lastW || 0)) > 4) { this._lastW = w; this._repaginate(); }
      }, 180);
    });
    this._resizeObs.observe(this.areaEl);
  }
  _applyTheme() {
    const t = erTheme(this.plugin.settings);
    const m = this.modalEl;
    m.style.setProperty("--er-bg", t.bg);
    m.style.setProperty("--er-text", t.text);
    m.style.setProperty("--er-ui", t.ui);
    m.style.setProperty("--er-border", t.border);
    m.style.setProperty("--er-accent", t.accent);
    m.style.setProperty("--er-muted", t.muted);
    m.style.background = t.bg;
  }
  _buildDOM() {
    const root = this.contentEl;
    root.empty();
    const pb = root.createDiv("er-pbar");
    this.pbarFill = pb.createDiv("er-pbar-fill");
    const top = root.createDiv("er-top");
    const lb  = top.createDiv("er-ibtn");
    svgIcon(lb, "arrow-left");
    lb.setAttribute("aria-label", __ertr("Закрыть книгу"));
    lb.addEventListener("click", () => this.close());
    this.titleEl = top.createDiv("er-top-title");
    this.titleEl.setText(this.file.basename);
    const tr     = top.createDiv("er-top-right");
    this.timerBtnEl = tr.createDiv("er-timerbtn");
    this.timerIconEl = this.timerBtnEl.createDiv("er-timer-ic");
    this.timerLabelEl = this.timerBtnEl.createDiv("er-timer-label");
    this.timerResetEl = this.timerBtnEl.createDiv("er-timer-reset");
    svgIcon(this.timerResetEl, "rotate-ccw");
    this.timerResetEl.setAttribute("aria-label", __ertr("Сбросить таймер"));
    this.timerResetEl.addEventListener("click", (e) => { e.stopPropagation(); resetTimerSession(this); });
    this.timerBtnEl.setAttribute("aria-label", __ertr("Таймер: сколько осталось до цели — старт/пауза"));
    this.timerBtnEl.addEventListener("click", () => toggleTimerSession(this));
    updateTimerBtn(this);
    // The mobile toolbar was cramped (title squeezed to «Д..»). The secondary
    // actions now live inside ONE «⋯» button that opens a native menu, so the top
    // bar keeps only the timer, «⋯» and the reading-settings ⚙ — the book title
    // finally has room to breathe.
    const moreBtn = tr.createDiv("er-ibtn er-b-more");
    svgIcon(moreBtn, "more-horizontal");
    moreBtn.setAttribute("aria-label", __ertr("Ещё"));
    moreBtn.addEventListener("click", (e) => {
      const menu = new Menu();
      menu.addItem((it) => it.setTitle(__ertr("Заметка книги")).setIcon("notebook-pen").onClick(() => openOrCreateBookNoteBeside(this.plugin, this.file)));
      menu.addItem((it) => it.setTitle(__ertr("Поиск по книге")).setIcon("search").onClick(() => {
        this._togglePanel("find");
        if (this._findInput) erAutoFocus(this._findInput, 80);
      }));
      menu.addItem((it) => it.setTitle(__ertr("Оглавление")).setIcon("list").onClick(() => this._togglePanel("toc")));
      menu.addItem((it) => it.setTitle(__ertr("Выделения")).setIcon("highlighter").onClick(() => this._togglePanel("highlights")));
      // The ↺ next to the timer is hidden on a phone — the pill was taking a
      // third of the bar and leaving the book title as «Выготски…». It is used
      // about once a session, so it belongs here rather than in the top row.
      menu.addItem((it) => it.setTitle(__ertr("Сбросить таймер")).setIcon("rotate-ccw").onClick(() => resetTimerSession(this)));
      menu.addItem((it) => it.setTitle(__ertr("Настройки чтения")).setIcon("sliders").onClick(() => new ReadSettingsModal(this.app, this).open()));
      addBookFileMenu(this.app, menu, this.file);
      menu.addSeparator();
      menu.addItem((it) => it.setTitle(__ertr("Закрыть книгу")).setIcon("x").onClick(() => this.close()));
      menu.showAtMouseEvent(e);
    });
    // No ✕ in the bar. There used to be one, and it did exactly what the ← two
    // controls to its left already does — close the book. Two buttons for one
    // action, in a bar that had no room for the book's title. The library sets
    // the pattern: one way back, everything rarer folded into «⋯».
    // «Справка» перенесена в панель настроек, чтобы верхняя панель была чище.
    this.areaEl = root.createDiv("er-area er-marea");
    if ((this.plugin.settings.navMode || "buttons") === "click") root.addClass("er-navclick");
    // Bottom reading-goal progress bar removed by request; the ▶ timer stays in the top bar.
    const bot = root.createDiv("er-bot");
    const pv  = bot.createDiv("er-navbtn");
    svgIcon(pv, "chevron-left");
    pv.addEventListener("click", () => this._nav("prev"));
    const center = bot.createDiv("er-bot-center");
    this.locEl = center.createDiv("er-loc er-loc-clickable");
    this.locEl.setAttribute("aria-label", __ertr("Перейти к странице"));
    this.locEl.addEventListener("click", () => {
      if (!this.file || !this.pager || !this.pager.total) return;
      new GoToPageModal(this.app, this.pager.total, this.pager.spread, (n) => {
        const [cur, tot] = this.pager.jumpTo(n - 1);
        this._updateUI(cur, tot);
        this.plugin.saveProgress(this.file.path, cur, tot, this.pager.currentBlockIndex());
      }).open();
    });
    this.pctEl = center.createDiv("er-pct");
    this.pctEl.setText("0%");
    const nx = bot.createDiv("er-navbtn");
    svgIcon(nx, "chevron-right");
    nx.addEventListener("click", () => this._nav("next"));
    this.overlayEl = root.createDiv("er-overlay");
    this.overlayEl.addEventListener("click", () => this._closePanel());
    this.settPan = root.createDiv("er-panel");
    this.tocPan  = root.createDiv("er-panel er-toc-panel");
    this.hlPan   = root.createDiv("er-panel er-toc-panel er-hl-panel");
    this.findPan = root.createDiv("er-panel er-toc-panel er-find-panel");
    this._buildSettPanel();
    this._buildTocPanel();
    this._buildHlPanel();
    this._buildFindPanel();
    this.hlPopup = root.createDiv("er-hl-popup");
    this._buildHlPopup();
    this._selHandler = () => this._scheduleSelCheck();
    this._selDoc = docOf(this.areaEl);
    this._selDoc.addEventListener("selectionchange", this._selHandler);
    this.areaEl.addEventListener("click", (e) => {
      // A footnote reference wins over everything else on the page: the reader
      // tapped a number, not the paragraph behind it.
      const refEl = e.target instanceof HTMLElement ? e.target.closest("[data-er-ref]") : null;
      if (refEl) {
        e.preventDefault();
        e.stopPropagation();
        if (followFootnote(this, refEl.getAttribute("data-er-ref"))) return;
      }
      const imgEl = e.target instanceof HTMLElement ? e.target.closest("img") : null;
      if (imgEl && imgEl.src) { e.preventDefault(); openImageLightbox(imgEl.currentSrc || imgEl.src, this.app, imgEl); return; }
      const span = e.target instanceof HTMLElement ? e.target.closest(".er-hl") : null;
      if (span) { e.preventDefault(); this._openHlEdit(span.getAttribute("data-hl-id")); }
      else if (this._editHlId) this._hideHlPopup();
    });
    // Horizontal swipe = turn page. A long-press (start a selection) or an active
    // selection must NOT be hijacked, so the user can still select text.
    let sx = 0, sy = 0, dir = null, longPress = false, lpTimer = null, hadSel = false;
    this.areaEl.addEventListener("touchstart", e => {
      if (e.touches.length > 1) { dir = "v"; return; }
      sx = e.touches[0].clientX; sy = e.touches[0].clientY; dir = null; longPress = false;
      const sel = selOf(this.areaEl);
      hadSel = !!(sel && !sel.isCollapsed);
      window.clearTimeout(lpTimer);
      lpTimer = window.setTimeout(() => { longPress = true; }, 350);
    }, { passive: true });
    this.areaEl.addEventListener("touchmove", e => {
      if (dir) { if (dir === "h") e.preventDefault(); return; }
      const dx = Math.abs(e.touches[0].clientX - sx), dy = Math.abs(e.touches[0].clientY - sy);
      if (dx < 8 && dy < 8) return;
      window.clearTimeout(lpTimer);
      const sel = selOf(this.areaEl);
      if (longPress || hadSel || (sel && !sel.isCollapsed)) { dir = "v"; return; }
      dir = dx > dy ? "h" : "v";
      if (dir === "h") e.preventDefault();
    }, { passive: false });
    this.areaEl.addEventListener("touchend", e => {
      window.clearTimeout(lpTimer);
      if (dir !== "h") return;
      const dx = e.changedTouches[0].clientX - sx;
      if (Math.abs(dx) > 44) this._nav(dx < 0 ? "next" : "prev");
    }, { passive: true });
    // Tap left/right side of the page to turn it (when "По клику" is enabled).
    this.areaEl.addEventListener("click", (e) => handleAreaNavClick(this, e));
    // Immersive chrome, on the phone as well.
    //
    // The setting promises the bars dim out of the way while you read, and on a
    // phone it did nothing at all: the desktop arms it from `pointermove`, and a
    // finger does not move a pointer. A touch is what wakes it here — and the
    // whole point of a phone reader is that the book is the screen.
    const armImmersive = () => {
      const root = this.contentEl;
      if (!root) return;
      if (!this.plugin.settings.immersive) { root.removeClass("er-immersive"); return; }
      root.removeClass("er-immersive");
      window.clearTimeout(this._immTimer);
      this._immTimer = window.setTimeout(() => {
        if (this.bookHtml && this.contentEl) this.contentEl.addClass("er-immersive");
      }, 2600);
    };
    this._armImmersive = armImmersive;
    this.contentEl.addEventListener("touchstart", armImmersive, { passive: true });
    this.contentEl.addEventListener("pointerdown", armImmersive);
    armImmersive();
  }
  // Settings changes (theme/font/size/line-height) → rebuild the pages, keeping
  // the current reading %. (Named _applyContentStyle for the panel callers.)
  async _applyContentStyle() {
    await this._repaginate();
  }
  async _repaginate() {
    if (!this.bookHtml || !this.areaEl || !this.areaEl.clientWidth) return;
    // Anchor on the paragraph, not the percentage — see the desktop repaginate().
    // Here it matters on font-size changes and screen rotation.
    const savedBlock = this.pager.currentBlockIndex();
    const savedPct = this.pager.currentPct;
    // Re-flowing necessarily lays the book out from spread 0 before it can jump
    // back to where the reader was. Unhidden, that is a page they can see change
    // twice — the same flicker the opening sequence hides for the same reason.
    this.areaEl.addClass("er-booting");
    erShowVeil(this);
    const [, total] = await this.pager.build(this.areaEl, this.bookHtml, this.plugin.settings, 0);
    const target = (typeof savedBlock === "number" && savedBlock >= 0)
      ? this.pager.spreadForBlock(savedBlock)
      : Math.round(savedPct * Math.max(0, total - 1));
    this._renderFlowHighlights();
    const [cur, tot] = this.pager.jumpTo(target);
    erRevealWhenSettled(this);
    this._updateUI(cur, tot);
    // Everything below is tied to the block elements that were just replaced:
    // the spread numbers in the contents list, the search corpus, and the
    // highlight ranges painted over the old nodes.
    if (this._tocRender) this._tocRender();
    this._findCorpus = null;
    if (this._foundQuery) this._markFound(this._foundQuery);
  }
  async _loadBook() {
    this.areaEl.empty();
    const loading = this.areaEl.createDiv("er-loading");
    loading.addClass("er-centered");
    loading.createDiv("er-spin");
    const loadText = loading.createDiv("er-loading-text");
    loadText.setText(__ertr("\u0417\u0430\u0433\u0440\u0443\u0436\u0430\u0435\u043C \u043A\u043D\u0438\u0433\u0443\u2026"));
    await new Promise((r) => window.requestAnimationFrame(r));
    await new Promise((r) => window.requestAnimationFrame(r));
    try {
      this._pdfLazy?.destroy?.();
      this._pdfLazy = null;
      if (this.ext === "epub") {
        this.bookHtml = await extractEpub(this.file, this.app);
      } else if (this.ext === "fb2") {
        this.bookHtml = await extractFb2(this.file, this.app);
      } else {
        const res = await extractPdf(this.file, this.app, this.plugin.settings, (i, n) => loadText.setText(__ertr("Готовим книгу… {0}%", (Math.round(i / n * 100)))));
        this.bookHtml = res.html;
        this._pdfLazy = res.lazy;
        this._pdfOutline = res.outline;
      }
      // TOC anchored to the global block index \u2192 tap jumps to that page.
      this.tocItems = buildTocItems(this.bookHtml, this._pdfOutline);
      this._buildTocPanel();
      await this.plugin.refreshHighlights();
      await this.plugin.refreshProgress();
      const saved = this.plugin.getProgress(this.file.path);
      const pct = (saved == null ? void 0 : saved.pct) != null ? saved.pct : 0;
      this.areaEl.addClass("er-booting");
      erShowVeil(this);
      // Ceiling on the hold. If anything between here and the jump throws, the
      // book must still appear — a blank page is far worse than a visible jump.
      window.setTimeout(() => {
        if (this.areaEl) this.areaEl.removeClass("er-booting");
        erHideVeil(this);
      }, 3000);
      await this.pager.build(this.areaEl, this.bookHtml, this.plugin.settings, 0);
      const hasBlock = saved && typeof saved.block === "number" && saved.block >= 0;
      const target = hasBlock
        ? this.pager.spreadForBlock(saved.block)
        : Math.round(pct * Math.max(0, this.pager.total - 1));
      this._renderFlowHighlights();
      const [cur, tot] = this.pager.jumpTo(target);
      this._updateUI(cur, tot);
      // Not one frame — the dialog can still be settling on a phone, and a
      // re-flow landing after the reveal is a page the reader watches change.
      erRevealWhenSettled(this);
      if (hasBlock) this._flashBlock(saved.block);
      // Same as desktop: the panel was built before a file existed, so rebuild it
      // now that the per-book settings have a book to bind to.
      this._buildSettPanel();
      // First open of this book → offer to set up its note. Mobile never asked
      // at all before, so a phone-only reader had no way into this.
      this._maybePromptBookNote(this.file);
    } catch (e) {
      console.error("ReaderModal:", e);
      this.areaEl.empty();
      this.areaEl.createEl("p", { cls: "er-load-error", text: __ertr("Ошибка: {0}", e.message) });
    }
  }
  // First open of a book \u2192 the setup screen (create / pick / skip). Same rules as
  // the desktop view: never for a book that already has a note, never twice.
  _maybePromptBookNote(file) {
    const s = this.plugin.settings;
    if (!file) return;
    if (!s.bookNoteLinks) s.bookNoteLinks = {};
    if (!s.bookNotePrompted) s.bookNotePrompted = {};
    const action = bookNoteAction(s, file.path);
    if (action === "linked" || action === "prompted") return;
    if (action === "auto") {
      s.bookNotePrompted[file.path] = true;
      this.plugin.ensureBookNote(file).then((note) => {
        if (note) new Notice(__ertr("\u0417\u0430\u043c\u0435\u0442\u043a\u0430 \u043a\u043d\u0438\u0433\u0438 \u0441\u043e\u0437\u0434\u0430\u043d\u0430: {0}", note.basename));
      });
      return;
    }
    new BookSetupModal(this.app, this.plugin, file, () => {}).open();
  }
  // Jump to the page holding a global block index, flash it, save the position.
  _jumpToBlock(block, flash = true) {
    if (!this.bookHtml) return;
    const [cur, tot] = this.pager.jumpTo(this.pager.spreadForBlock(block));
    this._updateUI(cur, tot);
    if (this.file) this.plugin.saveProgress(this.file.path, cur, tot, this.pager.currentBlockIndex());
    if (flash) this._flashBlock(block);
  }
  // Briefly highlight the paragraph the reader resumed at.
  // Jump to a paragraph as soon as the book is laid out. Called from a backlink,
  // which arrives while the book is still being built, so it waits for the
  // pager rather than assuming the text is already there. Gives up after a few
  // seconds instead of polling forever on a book that failed to open.
  // Land on a PDF page once the book is laid out. Pages are marked in the flow
  // with data-pdf-page-no, so this is a lookup rather than a guess.
  jumpToPdfPageWhenReady(pageNo) {
    let tries = 0;
    const tick = () => {
      const flow = this.pager && this.pager.flow;
      if (flow && this.pager.total) {
        const el = flow.querySelector(`[data-pdf-page-no="${pageNo}"]`);
        if (el) {
          const x = el.getBoundingClientRect().left - flow.getBoundingClientRect().left;
          const stride = this.pager.sw / (this.pager.cols || 1);
          const spread = Math.floor(Math.round(x / stride) / (this.pager.cols || 1));
          const [cur, tot] = this.pager.jumpTo(Math.max(0, Math.min(spread, this.pager.total - 1)));
          (this.updateUI || this._updateUI).call(this, cur, tot);
          return;
        }
      }
      if (++tries > 40) return;
      window.setTimeout(tick, 100);
    };
    tick();
  }
  jumpToBlockWhenReady(idx) {
    let tries = 0;
    const tick = () => {
      if (this.pager && this.pager.flow && this.pager.total) {
        const [cur, tot] = this.pager.jumpTo(this.pager.spreadForBlock(idx));
        (this.updateUI || this._updateUI).call(this, cur, tot);
        this._flashBlock(idx);
        return;
      }
      if (++tries > 40) return;
      window.setTimeout(tick, 100);
    };
    tick();
  }
  _flashBlock(idx) {
    const el = this.pager.blockEl(idx);
    if (!el) return;
    el.classList.remove("er-resume-flash");
    void el.offsetWidth;
    el.classList.add("er-resume-flash");
    window.setTimeout(() => el.classList.remove("er-resume-flash"), 2400);
  }
  _nav(dir) {
    if (!this.bookHtml) return;
    // Anti-double-turn guard — see ReaderView.nav() for the full rationale.
    // Collapses the iOS ghost-click / duplicate touch that flips two pages per swipe.
    const _now = Date.now();
    if (this._lastNavTs && _now - this._lastNavTs < 90) return;
    this._lastNavTs = _now;
    this._lastActive = _now;
    this._hideHlPopup();
    const [cur, total] = dir === "next" ? this.pager.next() : this.pager.prev();
    this._updateUI(cur, total);
    this.plugin.saveProgress(this.file.path, cur, total, this.pager.currentBlockIndex());
  }
  exportHighlights(evt) {
    if (!this.file) { new Notice(__ertr("Книга не открыта")); return; }
    // Chapter + page are computed from the CURRENT layout, so they are attached
    // here rather than stored with the highlight.
    const list = enrichHighlights(this, this.plugin.getHighlights(this.file.path));
    exportHighlightsMenu(this.app, this.plugin, this.file, list, evt);
  }
  _updateUI(cur, total) {
    if (this.contentEl) this.contentEl.toggleClass("er-scrolling", !!(this.pager && this.pager.scrollMode));
    cur = cur != null ? cur : this.pager.spread;
    total = total != null ? total : this.pager.total;
    const pct = total > 0 ? Math.round((cur + 1) / total * 100) : 0;
    this.pbarFill.style.width = `${pct}%`;
    const bookPage = currentBookPage(this);
    this.locEl.setText(bookPage ? __ertr("стр. {0}", bookPage) + " · " + `${cur + 1} / ${total}` : `${cur + 1} / ${total}`);
    this.pctEl.setText(`${pct}%`);
    renderVisibleFigures(this);
  }
  _buildSettPanel() {
    const p = this.settPan;
    p.empty();
    p.createDiv("er-pan-title").setText(__ertr("\u041D\u0430\u0441\u0442\u0440\u043E\u0439\u043A\u0438"));
    const sec = l => p.createDiv("er-pan-sec").setText(l);
    sec(__ertr("\u0422\u0435\u043C\u0430"));
    const thRow = p.createDiv("er-theme-row");
    ["auto","dark","light","sepia","eink"].forEach(t => {
      const btn = thRow.createDiv(`er-theme-btn er-theme-${t}`);
      btn.setText({ auto:__ertr("Как в Obsidian"), dark:__ertr("\u0422\u0451\u043C\u043D\u0430\u044F"), light:__ertr("\u0421\u0432\u0435\u0442\u043B\u0430\u044F"), sepia:"Sepia", eink:"E-ink" }[t]);
      if (this.plugin.settings.theme === t) btn.addClass("active");
      btn.addEventListener("click", async () => {
        this.plugin.settings.theme = t;
        await this.plugin.saveAll();
        // Только цвета: пересобирать страницы ради темы не нужно.
        this._applyTheme();
        thRow.querySelectorAll(".er-theme-btn").forEach(b => b.removeClass("active"));
        btn.addClass("active");
      });
    });
    sec(__ertr("\u0420\u0430\u0437\u043C\u0435\u0440 \u0448\u0440\u0438\u0444\u0442\u0430"));
    const szRow = p.createDiv("er-sz-row");
    const szMinus = szRow.createDiv("er-sz-btn"); szMinus.setText("A\u2212");
    this.szLabel = szRow.createDiv("er-sz-label");
    this.szLabel.setText(`${this.plugin.settings.fontSize}px`);
    const szPlus = szRow.createDiv("er-sz-btn"); szPlus.setText("A+");
    const chSz = async d => {
      this.plugin.settings.fontSize = Math.min(32, Math.max(12, this.plugin.settings.fontSize + d));
      this.szLabel.setText(`${this.plugin.settings.fontSize}px`);
      await this.plugin.saveAll();
      this._applyContentStyle();
    };
    szMinus.addEventListener("click", () => chSz(-1));
    szPlus.addEventListener("click",  () => chSz(+1));
    // Progressive disclosure: theme and text size are what readers actually
    // touch mid-book; the rest is set once and then forgotten. One toggle, one
    // level deep — nesting further is where options stop being findable.
    const advHdr = p.createDiv("er-pan-adv-hdr");
    advHdr.createSpan({ cls: "er-pan-adv-ic", text: "\u2699\uFE0F" });
    advHdr.createSpan({ cls: "er-pan-adv-lbl", text: __ertr("\u0414\u043E\u043F. \u043D\u0430\u0441\u0442\u0440\u043E\u0439\u043A\u0438") });
    const advCar = advHdr.createSpan({ cls: "er-pan-adv-car", text: "\u203A" });
    const advWrap = p.createDiv("er-pan-adv");
    const adv = advWrap.createDiv("er-pan-adv-body");
    const secA = (l) => adv.createDiv("er-pan-sec").setText(l);
    if (this.plugin.settings.readerAdvOpen) { advWrap.addClass("er-pan-adv-on"); advCar.addClass("er-pan-adv-car-on"); }
    advHdr.addEventListener("click", async () => {
      const on = advWrap.hasClass("er-pan-adv-on");
      advWrap.toggleClass("er-pan-adv-on", !on);
      advCar.toggleClass("er-pan-adv-car-on", !on);
      this.plugin.settings.readerAdvOpen = !on;
      await this.plugin._saveLocalData();
    });
    secA(__ertr("\u0428\u0440\u0438\u0444\u0442"));
    const ffRow = adv.createDiv("er-ff-row");
    erReaderFonts().forEach((font) => {
      const ff = font.id;
      const btn = ffRow.createDiv("er-ff-btn");
      btn.setText(erFontLabel(font)); btn.style.fontFamily = font.stack;
      if (this.plugin.settings.fontFamily === ff) btn.addClass("active");
      btn.addEventListener("click", async () => {
        this.plugin.settings.fontFamily = ff;
        await this.plugin.saveAll();
        this._applyContentStyle();
        ffRow.querySelectorAll(".er-ff-btn").forEach(b => b.removeClass("active"));
        btn.addClass("active");
      });
    });
    secA(__ertr("\u041C\u0435\u0436\u0441\u0442\u0440\u043E\u0447\u043D\u044B\u0439"));
    const lhRow = adv.createDiv("er-lh-row");
    [1.4,1.6,1.8,2.1].forEach(lh => {
      const btn = lhRow.createDiv("er-lh-btn");
      btn.setText(`${lh}`);
      if (Math.abs(this.plugin.settings.lineHeight - lh) < 0.05) btn.addClass("active");
      btn.addEventListener("click", async () => {
        this.plugin.settings.lineHeight = lh;
        await this.plugin.saveAll();
        this._applyContentStyle();
        lhRow.querySelectorAll(".er-lh-btn").forEach(b => b.removeClass("active"));
        btn.addClass("active");
      });
    });
    buildReaderExtraSettings(this, adv);
    this._histRow = panelSection(this, p, {
      label: __ertr("Вернуться к месту"), emoji: "🔖", settingKey: "readerHistOpen",
    }).createDiv("er-hist-row");
    this._renderHistory();
    p.createDiv("er-pan-sec").setText(__ertr("Действия"));
    const actRow = p.createDiv("er-act-row");
    const actBtn = actRow.createDiv("er-act-btn");
    iconLabel(actBtn, "info", __ertr("Справка"));
    actBtn.addEventListener("click", () => { this._closePanel(); new InfoModal(this.app, this.plugin, this.file).open(); });
  }
  _renderHistory() {
    const c = this._histRow;
    if (!c) return;
    c.empty();
    const list = this.file ? this.plugin.getBackups(this.file.path) : [];
    // Keep the collapsed header's counter in step with the list inside it.
    const badge = c.parentElement && c.parentElement._erCount;
    if (badge) badge.setText(list.length ? String(list.length) : "");
    if (!list.length) { c.createDiv("er-hist-empty").setText(__ertr("Точек пока нет")); return; }
    [...list].reverse().slice(0, 14).forEach((snap) => {
      const chip = c.createDiv("er-hist-chip");
      const d = new Date(snap.ts || snap.lastRead || Date.now());
      chip.setText(`${snap.percent}% · ${d.toLocaleString(__erLocale(), { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" })}`);
      chip.addEventListener("click", () => {
        if (!this.bookHtml) return;
        this._closePanel();
        if (typeof snap.block === "number" && snap.block >= 0) {
          this._jumpToBlock(snap.block);
        } else {
          const frac = typeof snap.pct === "number" ? snap.pct : (snap.percent || 0) / 100;
          const [cur, tot] = this.pager.jumpTo(Math.round(frac * Math.max(0, this.pager.total - 1)));
          this._updateUI(cur, tot);
          if (this.file) this.plugin.saveProgress(this.file.path, cur, tot, this.pager.currentBlockIndex());
        }
        new Notice(__ertr("Вернулись к {0}%", (snap.percent)));
      });
    });
  }
  _buildTocPanel() {
    this._tocRender = buildTocPanelFor(this, this.tocPan, {
      close: () => this._closePanel(),
      jump: (b) => this._jumpToBlock(b),
    });
  }
  _buildFindPanel() {
    buildFindPanelFor(this, this.findPan, {
      close: () => this._closePanel(),
      jump: (b) => this._jumpToBlock(b),
    });
  }
  _markFound(query) { markFoundIn(this, query); }
  _clearFound() { clearFoundIn(this); }
  _togglePanel(name) {
    if (this.panelOpen === name) { this._closePanel(); return; }
    this._hideHlPopup();
    if (name === "highlights") this._buildHlPanel();
    if (name === "settings") this._renderHistory();
    this.panelOpen = name;
    this.settPan.classList.toggle("er-panel-open", name === "settings");
    this.tocPan.classList.toggle("er-panel-open", name === "toc");
    this.hlPan.classList.toggle("er-panel-open", name === "highlights");
    this.overlayEl.classList.add("er-overlay-on");
  }
  _closePanel() {
    this.panelOpen = null;
    this.settPan.classList.remove("er-panel-open");
    this.tocPan.classList.remove("er-panel-open");
    this.hlPan.classList.remove("er-panel-open");
    // Guarded: the mobile reader has no search panel.
    if (this.findPan) this.findPan.classList.remove("er-panel-open");
    this.overlayEl.classList.remove("er-overlay-on");
  }
  // ── Highlights (mobile) ───────────────────────────────
  // Now identical to the desktop flow model: highlights are addressed by the
  // GLOBAL block index inside the single paginated flow (no per-section offset).
  _renderFlowHighlights() {
    if (!this.file || !this.pager.flow) return;
    unwrapAllHighlights(this.pager.flow);
    const blocks = this.pager.flow.querySelectorAll("p,h1,h2,h3,h4");
    const list = this.plugin.getHighlights(this.file.path);
    for (const hl of list) {
      const block = blocks[hl.block];
      if (!block) continue;
      const text = block.textContent;
      const loc = locateHl(text, hl);
      if (!loc) continue;
      wrapBlockRange(block, loc.start, loc.start + loc.len, { id: hl.id, color: hlColorCss(hl.color) });
    }
  }
  _scheduleSelCheck() {
    window.clearTimeout(this._selTimer);
    this._selTimer = window.setTimeout(() => this._onSelectionCheck(), 80);
  }
  _onSelectionCheck() {
    if (this._editHlId || this._commentEditing) return;
    const sel = selOf(this.areaEl);
    if (!sel || sel.isCollapsed || sel.rangeCount === 0) { this._hideHlPopup(); return; }
    const range = sel.getRangeAt(0);
    const flow = this.pager.flow;
    if (!flow || !flow.contains(range.startContainer)) { this._hideHlPopup(); return; }
    let node = range.startContainer;
    if (node.nodeType === Node.TEXT_NODE) node = node.parentElement;
    const block = node ? node.closest("p,h1,h2,h3,h4") : null;
    if (!block || !flow.contains(block)) { this._hideHlPopup(); return; }
    const blocks = [...flow.querySelectorAll("p,h1,h2,h3,h4")];
    const blockIndex = blocks.indexOf(block);
    if (blockIndex < 0) { this._hideHlPopup(); return; }
    // A selection can cross paragraphs, and it used to be cut off at the end of
    // the first one: dragging across three paragraphs coloured one and threw the
    // rest away. Each paragraph the range touches becomes its own segment — a
    // highlight is anchored to a block, so a multi-paragraph highlight is simply
    // several of them sharing a colour.
    const parts = [];
    for (let bi = blockIndex; bi < blocks.length; bi++) {
      const b = blocks[bi];
      if (bi > blockIndex && !range.intersectsNode(b)) break;
      const bText = b.textContent;
      const from = bi === blockIndex ? offsetInBlock(b, range.startContainer, range.startOffset) : 0;
      const ends = b.contains(range.endContainer);
      const to = ends ? offsetInBlock(b, range.endContainer, range.endOffset) : bText.length;
      if (to > from) {
        const seg = bText.slice(from, to);
        if (seg.trim()) {
          parts.push({
            block: bi,
            occ: countOccurrencesBefore(bText, seg, from),
            text: seg,
            pre: bText.slice(Math.max(0, from - 32), from),
            post: bText.slice(to, to + 32),
          });
        }
      }
      if (ends) break;
    }
    if (!parts.length) { this._hideHlPopup(); return; }
    // The first segment stays the head, so everything that reads _pendingSel
    // (comments, notes, the translator) keeps working unchanged; the rest ride
    // along in `parts`, and only the colouring walks them.
    this._pendingSel = { ...parts[0], parts, text: parts.map((p) => p.text).join(" ") };
    erPaintSelection(this, range);
    this._showHlPopup(erSelectionRect(range, this.areaEl));
  }
  _buildHlPopup() {
    const pop = this.hlPopup;
    pop.empty();
    pop.addEventListener("mousedown", (e) => {
      if (!(e.target instanceof HTMLElement) || !e.target.closest(".er-hl-comment-editor")) e.preventDefault();
    });
    // A thought in the margin. Distinct from "create a note": this stays WITH the
    // highlight instead of becoming a separate file — for "he contradicts himself
    // here", which does not deserve its own note.
    addBarButtons(this, pop);
  }
  _applyPopupColor(colorId) {
    if (this._editHlId && this.file) {
      const id = this._editHlId;
      this.plugin.setHighlightColor(this.file.path, id, colorId);
      this.pager.flow?.querySelectorAll(`[data-hl-id="${id}"]`).forEach((s) => { s.style.background = hlColorCss(colorId); });
      if (this.panelOpen === "highlights") this._buildHlPanel();
      this._hideHlPopup();
      return;
    }
    if (this._pendingSel && this.file) {
      // One highlight per paragraph the selection covered.
      const parts = this._pendingSel.parts || [this._pendingSel];
      for (const part of parts) this._createHighlight(part, colorId);
      selOf(this.areaEl)?.removeAllRanges();
      if (this.panelOpen === "highlights") this._buildHlPanel();
    }
    this._hideHlPopup();
  }
  // Same as in the desktop reader: needed so a comment can create the highlight
  // it hangs on. Returns the new id.
  _createHighlight(sel, colorId) {
    if (!sel || !this.file) return null;
    const id = "h" + Date.now().toString(36) + Math.random().toString(36).slice(2, 6);
    const hl = { id, color: colorId, text: sel.text, block: sel.block, occ: sel.occ, pre: sel.pre, post: sel.post, created: Date.now() };
    this.plugin.addHighlight(this.file.path, hl);
    const blocks = this.pager.flow ? this.pager.flow.querySelectorAll("p,h1,h2,h3,h4") : [];
    const block = blocks[hl.block];
    if (block) {
      const t = block.textContent;
      const loc = locateHl(t, hl);
      if (loc) wrapBlockRange(block, loc.start, loc.start + loc.len, { id: hl.id, color: hlColorCss(colorId) });
    }
    return id;
  }
  _currentHl() {
    if (this._editHlId && this.file) {
      const hl = this.plugin.getHighlights(this.file.path).find((h) => h.id === this._editHlId);
      if (hl) return { text: hl.text || "", block: hl.block, color: hl.color };
    }
    if (this._pendingSel) return { text: this._pendingSel.text || "", block: this._pendingSel.block, color: null };
    return null;
  }
  _openHlEdit(id) {
    const span = this.pager.flow?.querySelector(`[data-hl-id="${id}"]`);
    if (!span) return;
    this._pendingSel = null;
    this._editHlId = id;
    this._showHlPopup(span.getBoundingClientRect());
  }
  _unwrapHighlight(id) {
    const flow = this.pager.flow;
    if (!flow) return;
    flow.querySelectorAll(`[data-hl-id="${id}"]`).forEach((span) => {
      const parent = span.parentNode;
      while (span.firstChild) parent.insertBefore(span.firstChild, span);
      parent.removeChild(span);
      parent.normalize();
    });
  }
  _showHlPopup(rect) {
    const pop = this.hlPopup;
    this._hlPopupRect = rect;
    pop.classList.add("er-hl-popup-on");
    positionHlPopup(this, rect, 260, 44);
  }
  _hideHlPopup() {
    erClearPaintedSelection();
    closeInlineHighlightComment(this);
    this._hlPopupRect = null;
    this._pendingSel = null;
    this._editHlId = null;
    if (this.hlPopup) this.hlPopup.classList.remove("er-hl-popup-on");
  }
  goToHighlight(id) {
    const hl = this.file ? this.plugin.getHighlights(this.file.path).find((h) => h.id === id) : null;
    if (!hl) return;
    this._closePanel();
    const [cur, tot] = this.pager.jumpTo(this.pager.spreadForBlock(hl.block));
    this._updateUI(cur, tot);
    if (this.file) this.plugin.saveProgress(this.file.path, cur, tot, this.pager.currentBlockIndex());
    window.requestAnimationFrame(() => {
      const span = this.pager.flow?.querySelector(`[data-hl-id="${id}"]`);
      if (span) {
        span.classList.add("er-hl-flash");
        window.setTimeout(() => span.classList.remove("er-hl-flash"), 1200);
      }
    });
  }
  _buildHlPanel() {
    const p = this.hlPan;
    p.empty();
    p.createDiv("er-pan-title").setText(__ertr("Выделения"));
    const list = this.file ? this.plugin.getHighlights(this.file.path) : [];
    if (!list.length) { p.createDiv("er-toc-empty").setText(__ertr("Пока нет выделений.\nВыделите текст и выберите цвет.")); return; }
    const exp = p.createDiv("er-hl-export");
    iconLabel(exp, "download", __ertr("Экспортировать в заметки ({0})", list.length));
    exp.setAttribute("aria-label", __ertr("Экспортировать все выделения"));
    exp.addEventListener("click", (e) => this.exportHighlights(e));
    const wrap = p.createDiv("er-toc-list");
    list.forEach((hl) => {
      const item = wrap.createDiv("er-hl-item");
      const dot = item.createDiv("er-hl-dot");
      dot.style.background = hlColorCss(hl.color);
      // Quote + comment share one column (er-hl-body) so the comment stacks UNDER
      // the quote. Without the wrapper both were flex siblings of the row, and the
      // comment's long word squeezed the quote down to one letter per line.
      const body = item.createDiv("er-hl-body");
      const txt = body.createDiv("er-hl-text");
      txt.setText(hl.text.length > 160 ? hl.text.slice(0, 160) + "…" : hl.text);
      if (hl.comment) body.createDiv("er-hl-comment").setText(hl.comment);
      // Export just this one highlight — via the ⋯ button, tap-and-hold or right-click.
      const showHlMenu = (e) => {
        e.preventDefault();
        e.stopPropagation();
        if (!this.file) return;
        const menu = new Menu();
        menu.addItem((it) => it.setTitle(__ertr("Создать заметку")).setIcon("file-plus").onClick(() => {
          createNoteFromSelection(this.app, this.plugin, hl.text, this.file, { extra: hlCommentMd(hl), color: hl.color, hl });
        }));
        menu.addItem((it) => it.setTitle(__ertr("Текстом в заметку книги")).setIcon("text-quote").onClick(() => {
          sendQuoteToBookNote(this, hl);
        }));
        menu.showAtMouseEvent(e);
      };
      const more = item.createDiv("er-hl-more");
      svgIcon(more, "more");
      more.setAttribute("aria-label", __ertr("Ещё"));
      more.addEventListener("click", showHlMenu);
      const del = item.createDiv("er-hl-del");
      svgIcon(del, "trash");
      del.addEventListener("click", (e) => {
        e.stopPropagation();
        if (!this.file) return;
        this.plugin.removeHighlight(this.file.path, hl.id);
        this._unwrapHighlight(hl.id);
        this._buildHlPanel();
      });
      item.addEventListener("click", () => this.goToHighlight(hl.id));
      item.addEventListener("contextmenu", showHlMenu);
    });
  }
  async onClose() {
    await persistCurrentReaderPosition(this);
    stopReadingTimer(this);
    if (this.plugin._openReaderModal === this) this.plugin._openReaderModal = null;
    // The search paint is a document-level highlight; it would outlive the book.
    clearFoundIn(this);
    if (this._selHandler) (this._selDoc || document).removeEventListener("selectionchange", this._selHandler);
    this._resizeObs?.disconnect();
    this._pdfLazy?.destroy?.();
    this._pdfLazy = null;
    window.clearTimeout(this._rsT);
    window.clearTimeout(this._selTimer);
    window.clearTimeout(this._immTimer);
    window.clearTimeout(this._revealT);
    this._closeWatch?.disconnect();
    this.contentEl.empty();
  }
};
// One group of settings, in its own window.
//
// A settings page long enough to scroll is a page nobody reads: the option you
// need is buried among twenty you set once a year and never think about again.
// The handful of controls touched while actually reading stay on the tab; the
// rest move behind a button, grouped by the job they belong to.
const SettingsGroupModal = class extends Modal {
  constructor(app, title, build) {
    super(app);
    this.title = title;
    this.build = build;
  }
  onOpen() {
    this.modalEl.addClass("er-settings-group");
    this.draw();
  }
  draw() {
    const c = this.contentEl;
    // The scrolling box itself is rebuilt below, so the position has to be
    // carried over by hand rather than left to the browser.
    const was = this.bodyEl ? this.bodyEl.scrollTop : 0;
    c.empty();
    c.createEl("h3", { text: this.title });
    this.bodyEl = c.createDiv("er-group-body");
    // Rebuilt on every redraw, because some of these settings decide whether
    // the others exist at all.
    this.build(this.bodyEl, () => this.draw());
    const row = c.createDiv("er-group-actions");
    // "Done" rather than "Save": every control here writes the moment it is
    // touched, exactly as it did on the settings page.
    const done = row.createEl("button", { cls: "mod-cta", text: __ertr("Готово") });
    done.addEventListener("click", () => this.close());
    if (was) this.bodyEl.scrollTop = was;
  }
  onClose() { this.contentEl.empty(); }
};
const SettingsTab = class extends PluginSettingTab {
  // A row that stands for a whole group: name, one line on what is inside, and
  // the button that opens it.
  _group(c, { name, desc, build }) {
    new Setting(c)
      .setName(name)
      .setDesc(desc)
      .addButton((b) => b
        .setButtonText(__ertr("Настроить"))
        .onClick(() => new SettingsGroupModal(this.app, name, build).open()));
  }
  constructor(app, plugin) {
    super(app, plugin);
    this.plugin = plugin;
  }
  // Rebuild the page (needed when labels themselves change, e.g. the UI language)
  // while keeping the reader where they were — a plain display() drops the scroll
  // position back to the top, which felt like the settings "forgot" the place.
  _redraw() {
    const el = this.containerEl;
    const scroller = el.scrollHeight > el.clientHeight ? el : (el.closest(".vertical-tab-content") || el.parentElement || el);
    const y = scroller.scrollTop;
    this.display();
    scroller.scrollTop = y;
    window.requestAnimationFrame(() => { scroller.scrollTop = y; });
  }
  // Settings are split across tabs rather than one long scroll. Each tab is a
  // whole job ("I'm setting up notes", "I'm changing how pages turn"), so the
  // reader only ever faces the handful of options that belong to what they came
  // to do — instead of scanning ~20 unrelated rows to find one.
  display() {
    const { containerEl: c } = this;
    c.empty();
    c.createEl("h2", { text: "Qiaomu Book Reader" });
    const TABS = [
      { id: "read", label: __ertr("Чтение") },
      { id: "look", label: __ertr("Оформление") },
      { id: "notes", label: __ertr("Заметки") },
      { id: "translate", label: __ertr("Перевод") },
      { id: "data", label: __ertr("Данные") },
      { id: "about", label: __ertr("О плагине") }
    ];
    if (!this._tab || !TABS.some((t) => t.id === this._tab)) this._tab = "read";
    // Language sits ABOVE the tabs, not inside the last one.
    //
    // It used to live at the bottom of "About", which is the last place someone
    // who cannot read the interface would look — several readers said switching
    // to English was hard to find, and one gave up and asked in a comment.
    // A setting whose whole purpose is "I do not understand this screen" has to
    // be visible from every screen.
    new Setting(c)
      .setName(__ertr("Язык интерфейса"))
      .setDesc(__ertr("Язык интерфейса плагина. Откройте книгу заново, чтобы применить."))
      .addDropdown((d) => d
        .addOption("ru", "Русский")
        .addOption("en", "English")
        .addOption("zh", "简体中文")
        .setValue(this.plugin.settings.language || "zh")
        .onChange(async (v) => {
          this.plugin.settings.language = v;
          // Remember that this was a deliberate choice, so the automatic guess
          // below never overrides it later.
          this.plugin.settings.languagePicked = true;
          __erSetLang(v);
          await this.plugin.saveAll();
          this._redraw();
        }));
    const bar = c.createDiv("er-set-tabs");
    TABS.forEach((t) => {
      const el = bar.createDiv("er-set-tab");
      el.setText(t.label);
      if (t.id === this._tab) el.addClass("er-set-tab-on");
      el.addEventListener("click", () => { this._tab = t.id; this.display(); });
    });
    const body = c.createDiv("er-set-body");
    if (this._tab === "read") this._tabReading(body);
    else if (this._tab === "look") this._groupAppearance(body);
    else if (this._tab === "notes") this._tabNotes(body);
    else if (this._tab === "translate") this._tabTranslate(body);
    else if (this._tab === "data") this._tabData(body);
    else this._tabAbout(body);
  }
  // Lifetime reading stats. Built with createEl rather than innerHTML — no user
  // text is interpolated and store review flags raw HTML.
  _statsCard(c) {
    const st = readingStats(this.plugin.settings.readingLog, this.plugin.settings.lifetimeSeconds, readerTodayKey());
    const card = c.createDiv({ cls: "er-stats" });

    const head = card.createDiv({ cls: "er-stats-head" });
    const total = head.createDiv({ cls: "er-stats-total" });
    total.createDiv({ cls: "er-stats-big", text: fmtReadTime(st.total) });
    total.createDiv({ cls: "er-stats-cap", text: __ertr("за всё время с книгами") });
    // A streak is the one number worth calling out; hide it at zero instead of
    // showing "0 дней подряд", which reads as a scolding.
    if (st.streak > 0) {
      const fl = head.createDiv({ cls: "er-stats-streak" });
      fl.createSpan({ cls: "er-stats-flame", text: "🔥" });
      fl.createSpan({ text: __ertr("{0} дн. подряд", st.streak) });
    }

    const grid = card.createDiv({ cls: "er-stats-grid" });
    const cell = (label, value) => {
      const d = grid.createDiv({ cls: "er-stats-cell" });
      d.createDiv({ cls: "er-stats-val", text: value });
      d.createDiv({ cls: "er-stats-lab", text: label });
    };
    cell(__ertr("сегодня"), fmtReadTime(st.today));
    cell(__ertr("дней с книгой"), st.daysRead ? String(st.daysRead) : "—");
    cell(__ertr("в среднем за день"), fmtReadTime(st.avgPerDay));
    cell(__ertr("лучший день"), fmtReadTime(st.best));

    // Two weeks at a glance. Bars are relative to the best day in the window, so
    // the shape stays readable whether you read 10 minutes a day or three hours.
    const peak = st.recent.reduce((a, r) => Math.max(a, r.sec), 0);
    if (peak > 0) {
      const chart = card.createDiv({ cls: "er-stats-chart" });
      const bars = chart.createDiv({ cls: "er-stats-bars" });
      for (const r of st.recent) {
        const col = bars.createDiv({ cls: "er-stats-bar" + (r.sec > 0 ? " is-read" : "") });
        const fill = col.createDiv({ cls: "er-stats-fill" });
        // Any reading at all keeps a visible stub, so a short day isn't invisible.
        fill.style.height = r.sec > 0 ? Math.max(8, Math.round(r.sec / peak * 100)) + "%" : "2px";
        col.setAttr("aria-label", r.key + " — " + fmtReadTime(r.sec));
        col.setAttr("title", r.key + " — " + fmtReadTime(r.sec));
      }
      const legend = chart.createDiv({ cls: "er-stats-legend" });
      legend.createSpan({ text: __ertr("14 дней назад") });
      legend.createSpan({ text: __ertr("сегодня") });
    } else {
      card.createDiv({ cls: "er-stats-empty", text: __ertr("Откройте книгу и включите таймер ▶ — здесь появится история чтения.") });
    }
  }

  // ── Чтение ────────────────────────────────────────────────────────────────
  _tabReading(c) {
    this._statsCard(c);
    new Setting(c)
      .setName(__ertr("Ширина строки"))
      .setDesc(__ertr("Максимальная длина строки в символах. На широком мониторе строка во весь экран уходит за 150 символов, и глаз теряет начало следующей — привычный удобный диапазон 60–90. Лишняя ширина уходит в поля, разбивка книги на страницы от этого не меняется."))
      .addDropdown((d) => d
        .addOption("0", __ertr("Во всю ширину"))
        .addOption("60", "60")
        .addOption("70", "70")
        .addOption("80", "80")
        .addOption("90", "90")
        .setValue(String(this.plugin.settings.maxLineCh || 0))
        .onChange(async (v) => {
          this.plugin.settings.maxLineCh = Number(v) || 0;
          await this.plugin.saveAll();
          for (const leaf of this.app.workspace.getLeavesOfType(VIEW_TYPE)) {
            const view = leaf.view;
            if (view && view.bookHtml) view.repaginate();
          }
        }));
    new Setting(c)
      .setName(__ertr("Листание страниц"))
      .setDesc(__ertr("«Кнопками» — стрелки/клавиши/свайп. «По клику» — клик по левой/правой части страницы листает назад/вперёд (центр свободен для выделения текста)."))
      .addDropdown((d) => d
        .addOption("buttons", __ertr("Кнопками"))
        .addOption("click", __ertr("По клику мышкой"))
        .setValue(this.plugin.settings.navMode || "buttons")
        .onChange(async (v) => { this.plugin.settings.navMode = v; await this.plugin.saveAll(); }));
    new Setting(c)
      .setName(__ertr("Анимация листания"))
      .setDesc(__ertr("Страница плавно уезжает в сторону при перелистывании — по этому движению видно, что книга сдвинулась и в какую сторону. Не зависит от системной настройки «уменьшить анимацию»: та убирает украшения, а это обратная связь. Выключите, если предпочитаете мгновенное переключение."))
      .addToggle((t) => t.setValue(this.plugin.settings.pageTurnAnimation !== false).onChange(async (v) => {
        this.plugin.settings.pageTurnAnimation = v;
        await this.plugin.saveAll();
        for (const leaf of this.app.workspace.getLeavesOfType(VIEW_TYPE)) {
          const view = leaf.view;
          if (view && view.pager && view.pager.flow) {
            view.pager.animate = v;
            view.pager.flow.toggleClass("er-flow-anim", v);
          }
        }
      }));
    new Setting(c)
      .setName(__ertr("Как читать"))
      .setDesc(__ertr("Прогресс автоматически сохраняется при перелистывании, прокрутке и закрытии книги. В режиме прокрутки место привязано к абзацу у верхнего края экрана. «Добавить точку возврата» нужно только тогда, когда вы хотите позже вернуться именно сюда. Откройте книгу заново, чтобы применить."))
      .addDropdown((d) => d
        .addOption("pages", __ertr("Страницами"))
        .addOption("scroll", __ertr("Прокруткой"))
        .setValue(this.plugin.settings.readMode || "pages")
        .onChange(async (v) => {
          this.plugin.settings.readMode = v;
          await this.plugin.saveAll();
          for (const leaf of this.app.workspace.getLeavesOfType(VIEW_TYPE)) {
            const view = leaf.view;
            if (view && view.bookHtml) view.repaginate();
          }
        }));
    // Appearance used to hang off this tab as a button that opened a window.
    // It is a section of its own now — a whole group of settings behind one row
    // reads as an afterthought, and "how the page looks" is not an afterthought.
    // The daily goal is its own thing — a timer and a target, not a reading
    // preference. Under its own heading at the foot of the tab it stops
    // sitting between "how pages turn" and "how the page is animated".
    c.createEl("h3", { cls: "er-set-h", text: __ertr("Цель чтения") });
    new Setting(c)
      .setName(__ertr("Таймер цели чтения"))
      .setDesc(__ertr("Обратный отсчёт до дневной цели (например, 15 минут) — сколько ещё осталось прочитать. Запускается вручную кнопкой ▶ вверху читалки (пауза — ⏸)."))
      .addToggle((t) => t.setValue(this.plugin.settings.timerEnabled !== false).onChange(async (v) => {
        this.plugin.settings.timerEnabled = v; await this.plugin.saveAll();
      }));
    new Setting(c)
      .setName(__ertr("Цель на день, минут"))
      .setDesc(__ertr("Сколько минут в день вы хотите читать. Прогресс за сегодня — в карточке вверху этой вкладки."))
      .addSlider((sl) => sl.setLimits(5, 120, 5).setValue(this.plugin.settings.dailyGoalMin || 15).setDynamicTooltip().onChange(async (v) => {
        this.plugin.settings.dailyGoalMin = v; await this.plugin.saveAll();
      }));
    c.createEl("div", { cls: "er-set-note", text: __ertr("Как выглядит страница — во вкладке «Оформление». Шрифт, размер и межстрочный интервал настраиваются прямо в книге — иконка ползунков вверху читалки.") });
  }
  // Where the breakdown is fetched from. In its own window because it is set up
  // once and then never touched, and because the key field has no business
  // sitting next to the reading options.
  _groupAi(c, redraw) {
    const s = this.plugin.settings;
    const cfg = aiConfig(s);
    new Setting(c)
      .setName(__ertr("Сервис"))
      .addDropdown((d) => {
        for (const [id, p] of Object.entries(AI_PROVIDERS)) d.addOption(id, p.label);
        d.setValue(s.aiProvider || "eltonlabs").onChange(async (v) => {
          s.aiProvider = v;
          // The model belongs to the provider: carrying one service's model
          // name over to another fails on the first request with a bare 404.
          s.aiModel = "";
          await this.plugin.saveAll();
          redraw();
        });
      });
    if (AI_PROVIDERS[s.aiProvider || "eltonlabs"].needsKey) {
      new Setting(c)
        .setName(__ertr("Ключ"))
        .setDesc(__ertr("Хранится в настройках плагина, внутри вашего хранилища. Если хранилище синхронизируется, ключ едет вместе с ним — держите это в уме."))
        .addText((t) => {
          t.inputEl.type = "password";
          t.setPlaceholder("sk-…").setValue(s.aiKey || "").onChange(async (v) => {
            s.aiKey = v.trim();
            await this.plugin.saveAll();
          });
        });
    }
    new Setting(c)
      .setName(__ertr("Модель"))
      .setDesc(__ertr("Пусто — модель по умолчанию для этого сервиса: {0}", cfg.model))
      .addText((t) => t.setPlaceholder(cfg.model).setValue(s.aiModel || "").onChange(async (v) => {
        s.aiModel = v.trim();
        await this.plugin.saveAll();
      }));
    new Setting(c)
      .setName(__ertr("Свой системный промпт"))
      .setDesc(__ertr("Что именно делать с фрагментом. Пусто — встроенный разбор: перевод, трудные слова, обороты, этимология. Свой текст заменяет его целиком — и для разбора, и для ваших вопросов в окне разбора."))
      .addTextArea((t) => {
        t.inputEl.rows = 6;
        t.inputEl.addClass("er-ai-sys");
        t.setPlaceholder(__ertr("Например: объясни простыми словами и дай два примера из жизни."))
          .setValue(s.aiSystem || "").onChange(async (v) => {
            s.aiSystem = v;
            await this.plugin.saveAll();
          });
      });
    new Setting(c)
      .setName(__ertr("Отвечать на языке"))
      .setDesc(__ertr("На каком языке писать разбор. Язык самой книги определяется сам."))
      .addText((t) => t.setPlaceholder("中文").setValue(s.aiInto || "中文").onChange(async (v) => {
        s.aiInto = v.trim() || "中文";
        await this.plugin.saveAll();
      }));
    c.createEl("div", {
      cls: "er-set-note",
      text: cfg.id === "local"
        ? __ertr("Локальная модель: текст никуда не уходит, но нужен запущенный Ollama или LM Studio на этом же компьютере.")
        : __ertr("Выделенный фрагмент отправляется на {0}. Всё остальное в читалке работает офлайн.", cfg.base),
    });
  }
  // Set once and forgotten: kept out of the tab so what remains there is only
  // what a reader reaches for mid-book. Same controls, same behaviour.
  _groupAppearance(c) {
    c.createEl("h3", { text: __ertr("Режимы") });
    new Setting(c)
      .setName(__ertr("Свой вид на каждом устройстве"))
      .setDesc(__ertr("Размер шрифта, тема, шрифт, интервал, число колонок и выравнивание запоминаются отдельно для компьютера, планшета и телефона. Настройки хранятся в одном файле и синхронизируются, но каждое устройство читает свою часть, поэтому крупный шрифт на телефоне больше не делает его огромным на компьютере. Папки, шаблоны и прогресс чтения остаются общими. Это устройство: {0}.",
        __ertr({ desktop: "компьютер", tablet: "планшет", phone: "телефон" }[erDeviceKey()])))
      .addToggle((t) => t.setValue(this.plugin.settings.perDevice === true).onChange(async (v) => {
        this.plugin.settings.perDevice = v;
        // Turning it ON adopts whatever is on screen right now as this device's
        // look, so nothing changes under the reader at the moment of the click.
        await this.plugin.saveAll();
        this.display();
      }));
    new Setting(c)
      .setName(__ertr("Режим для e-ink читалок"))
      .setDesc(__ertr("Для Obsidian на Android-читалке с электронными чернилами. Убирает анимации, плавные переходы, тени и размытие — они оставляют на таком экране следы. Чистый чёрный на белом, жёсткие рамки, крупнее кнопки, листание без скольжения."))
      .addToggle((t) => t.setValue(this.plugin.settings.einkMode === true).onChange(async (v) => {
        this.plugin.settings.einkMode = v;
        // The e-ink palette is part of the mode; switching back restores light.
        if (v) this.plugin.settings.theme = "eink";
        else if (this.plugin.settings.theme === "eink") this.plugin.settings.theme = "auto";
        await this.plugin.saveAll();
        for (const leaf of this.app.workspace.getLeavesOfType(VIEW_TYPE)) {
          const view = leaf.view;
          if (view && view.applyVars) { view.applyVars(); if (view.bookHtml) view.repaginate(); }
        }
      }));
    c.createEl("h3", { text: __ertr("Текст на странице") });
    new Setting(c)
      .setName(__ertr("Выравнивание текста"))
      .setDesc(__ertr("Как выравнивается текст в колонке чтения. Можно менять и на лету — в панели настроек чтения (иконка ползунков) в самой книге. Откройте книгу заново, чтобы применить."))
      .addDropdown((d) => d
        .addOption("left", __ertr("Слева"))
        .addOption("justify", __ertr("По ширине"))
        .addOption("center", __ertr("По центру"))
        .addOption("right", __ertr("Справа"))
        .setValue(this.plugin.settings.textAlign || "left")
        .onChange(async (v) => { this.plugin.settings.textAlign = v; await this.plugin.saveAll(); }));
    new Setting(c)
      .setName(__ertr("Положение текста на странице"))
      .setDesc(__ertr("Если страница заполнена не до конца (например, в конце главы), текст можно не оставлять прижатым к верху. Меняется и на лету — в панели настроек чтения."))
      .addDropdown((d) => d
        .addOption("top", __ertr("Сверху"))
        .addOption("center", __ertr("По центру"))
        .addOption("bottom", __ertr("Снизу"))
        .setValue(this.plugin.settings.vAlign || "top")
        .onChange(async (v) => { this.plugin.settings.vAlign = v; await this.plugin.saveAll(); }));
    new Setting(c)
      .setName(__ertr("Показывать картинки из книги"))
      .setDesc(__ertr("По умолчанию ВЫКЛ: если из страницы извлекается текст — показывается только чистый текст. Включите, чтобы над текстом показывались иллюстрации, схемы и графики: вырезаются сами картинки, а не скриншот всей страницы. На сканах (где текст извлечь нельзя) страница по-прежнему показывается целиком. Откройте книгу заново, чтобы применить."))
      .addToggle((t) => t.setValue(this.plugin.settings.pdfShowFiguresOnTextPages === true).onChange(async (v) => {
        this.plugin.settings.pdfShowFiguresOnTextPages = v;
        await this.plugin.saveAll();
      }));
    new Setting(c)
      .setName(__ertr("Погружение (Immersive)"))
      .setDesc(__ertr("Панели сверху и снизу мягко притухают через пару секунд без движения мыши и мгновенно возвращаются при движении — чтобы ничто не отвлекало от текста."))
      .addToggle((t) => t.setValue(this.plugin.settings.immersive !== false).onChange(async (v) => {
        this.plugin.settings.immersive = v; await this.plugin.saveAll();
      }));
    if (Platform.isMobile) {
      new Setting(c)
        .setName(__ertr("Отступ сверху на телефоне"))
        .setDesc(__ertr("Обычно система сама сообщает высоту «шторки» с часами, и верхняя панель встаёт под ней. На части Android-оболочек (например, Samsung One UI) она этого не делает — панель заезжает под часы. Тогда впишите здесь высоту в пикселях, обычно 24–48. Ноль — доверять системе. Откройте книгу заново, чтобы применить."))
        .addText((t) => t
          .setPlaceholder("0")
          .setValue(String(this.plugin.settings.mobileTopInset || 0))
          .onChange(async (v) => {
            const n = Math.max(0, Math.min(120, Number(String(v).replace(/[^\d]/g, "")) || 0));
            this.plugin.settings.mobileTopInset = n;
            await this.plugin.saveAll();
          }));
    }
  }
  // ── Заметки ───────────────────────────────────────────────────────────────
  _tabNotes(c) {
    c.createEl("h3", { text: __ertr("Куда попадают заметки") });
    new Setting(c)
      .setName(__ertr("Папка для новых заметок"))
      .setDesc(__ertr("Куда кладутся ОТДЕЛЬНЫЕ заметки, которые вы создаёте из выделенного фрагмента («Создать заметку»). Одно выделение — один файл. Пусто — корень хранилища. Не путать с «Папкой заметок-книг» ниже: та отвечает за одну общую заметку на книгу."))
      .addText((t) => { t.setPlaceholder("Inbox").setValue(this.plugin.settings.notesFolder || "");
        attachPathInput(this.app, t, async (v) => {
          this.plugin.settings.notesFolder = v;
          await this.plugin.saveAll();
        }); });
    new Setting(c)
      .setName(__ertr("Класть заметки рядом с книгой"))
      .setDesc(__ertr("Заметка из выделения создаётся в той же папке, где лежит книга, а не в общей папке заметок. Если вы выбрали папку вручную в окне создания, побеждает ваш выбор. Для книги в корне хранилища используется папка из настройки выше."))
      .addToggle((t) => t.setValue(this.plugin.settings.notesNextToBook === true).onChange(async (v) => {
        this.plugin.settings.notesNextToBook = v;
        await this.plugin.saveAll();
      }));
    new Setting(c)
      .setName(__ertr("Куда открывать новую заметку"))
      .setDesc(__ertr("«Рядом с книгой» делит окно пополам, чтобы книга осталась на виду. «В новой вкладке» открывает поверх — книга останется открытой, но уйдёт с экрана."))
      .addDropdown((d) => d
        .addOption("split", __ertr("Рядом с книгой"))
        .addOption("tab", __ertr("В новой вкладке"))
        .addOption("none", __ertr("Не открывать"))
        .setValue(this.plugin.settings.noteOpenMode || "split")
        .onChange(async (v) => { this.plugin.settings.noteOpenMode = v; await this.plugin.saveAll(); }));
    new Setting(c)
      .setName(__ertr("Спрашивать название заметки"))
      .setDesc(__ertr("Перед созданием заметки из выделения появится окно с коротким названием — его можно исправить или одной кнопкой вставить фрагмент целиком. Без этого имя файла берётся из самого фрагмента и выходит очень длинным."))
      .addToggle((t) => t.setValue(this.plugin.settings.askNoteTitle !== false).onChange(async (v) => {
        this.plugin.settings.askNoteTitle = v;
        await this.plugin.saveAll();
        this._redraw();
      }));
    // Only meaningful when the dialog is off — otherwise the reader decides each time.
    if (this.plugin.settings.askNoteTitle === false) {
      new Setting(c)
        .setName(__ertr("Короткие названия без вопросов"))
        .setDesc(__ertr("Название подбирается автоматически: первое предложение фрагмента или его начало по границе слова. Выключено — в имя файла идёт весь фрагмент, как раньше."))
        .addToggle((t) => t.setValue(this.plugin.settings.shortNoteTitles !== false).onChange(async (v) => {
          this.plugin.settings.shortNoteTitles = v;
          await this.plugin.saveAll();
        }));
    }    c.createEl("h3", { text: __ertr("Цитаты и выделения") });
    new Setting(c)
      .setName(__ertr("Цвет выделения по умолчанию"))
      .setDesc(__ertr("Каким цветом подсветить фрагмент, если вы написали к нему комментарий, не выбрав цвет вручную. Комментарий может храниться только при выделении, поэтому оно создаётся само."))
      .addDropdown((d) => {
        HL_COLORS.forEach((col) => d.addOption(col.id, col.label()));
        d.setValue(this.plugin.settings.defaultHlColor || HL_COLORS[0].id)
          .onChange(async (v) => { this.plugin.settings.defaultHlColor = v; await this.plugin.saveAll(); });
      });
    // A multi-line field does not belong in the right-hand column of a settings
    // row. Obsidian lays that column out beside the name and description, so a
    // template box wide enough to read squeezed its own title down to a few
    // clipped letters — and the drag handle in the corner had nowhere to go.
    // The row is stacked instead: title and explanation on top, field the full
    // width underneath, resizable downwards like any textarea should be.
    const tpl = new Setting(c)
      .setName(__ertr("Формат скопированной цитаты"))
      .setDesc(__ertr("Что попадает в буфер по кнопке «Скопировать как цитату». Доступны {text}, {book}, {page}, {link}, {comment}. Пусто — вид по умолчанию."))
      .addTextArea((t) => {
        t.setPlaceholder(QUOTE_TEMPLATE_DEFAULT)
          .setValue(this.plugin.settings.quoteTemplate || "")
          .onChange(async (v) => {
            this.plugin.settings.quoteTemplate = v;
            await this.plugin.saveAll();
          });
        t.inputEl.rows = 4;
        t.inputEl.addClass("er-tpl-input");
      });
    new Setting(c)
      .setName(__ertr("Ссылка на место в книге под цитатой"))
      .setDesc(__ertr("К каждой выгруженной цитате добавляется ссылка, которая открывает книгу ровно на том абзаце, откуда цитата взята. Работает из любой заметки."))
      .addToggle((t) => t.setValue(this.plugin.settings.quoteBacklinks !== false).onChange(async (v) => {
        this.plugin.settings.quoteBacklinks = v;
        await this.plugin.saveAll();
      }));
    new Setting(c)
      .setName(__ertr("Сохранять цвет выделений при экспорте"))
      .setDesc(__ertr("Каждая цитата оборачивается в цветной <mark> — цвет выделения виден в готовой заметке (в режиме чтения и live preview, без плагинов). Выключите, если хотите обычные цитаты без HTML."))
      .addToggle((t) => t.setValue(this.plugin.settings.exportColors !== false).onChange(async (v) => {
        this.plugin.settings.exportColors = v;
        await this.plugin.saveAll();
      }));    c.createEl("h3", { text: __ertr("Заметка книги") });
    new Setting(c)
      .setName(__ertr("Своя заметка на каждую книгу"))
      .setDesc(__ertr("При первом открытии книги автоматически создаётся отдельная заметка с названием книги (в «Папке заметок-книг», иначе в «Папке для новых заметок») и привязывается к ней. Включено по умолчанию."))
      .addToggle((t) => t.setValue(this.plugin.settings.autoBookNote === true).onChange(async (v) => {
        this.plugin.settings.autoBookNote = v;
        await this.plugin.saveAll();
        if (v) new Notice(__ertr("Это первая версия функции — проверьте результат на паре книг. Заметка создаётся один раз при первом открытии книги."), 6e3);
      }));
    new Setting(c)
      .setName(__ertr("Цитаты сразу в заметку книги"))
      .setDesc(__ertr("Каждое новое выделение и изменение комментария синхронизируется с заметкой этой книги — с главой, номером страницы и ссылкой обратно на место в тексте. Отдельные файлы при этом не создаются. Включено по умолчанию."))
      .addToggle((t) => t.setValue(this.plugin.settings.quotesToBookNote === true).onChange(async (v) => {
        this.plugin.settings.quotesToBookNote = v;
        await this.plugin.saveAll();
      }));
    new Setting(c)
      .setName(__ertr("Папка заметок-книг (для ссылок)"))
      .setDesc(__ertr("Где лежат заметки-КНИГИ — по одной на книгу, куда собираются все цитаты из неё. Из этой папки берётся список, когда вы привязываете заметку к книге, и она же используется при автосоздании. Пусто — можно выбрать любую заметку хранилища."))
      .addText((t) => { t.setPlaceholder(__ertr("3. Resources/База книг")).setValue(this.plugin.settings.bookNotesFolder || "");
        attachPathInput(this.app, t, async (v) => {
          this.plugin.settings.bookNotesFolder = v;
          await this.plugin.saveAll();
        }); });
    new Setting(c)
      .setName(__ertr("Шаблон заметки книги"))
      .setDesc(__ertr("Применяется только к общей заметке книги, которая создаётся один раз и собирает выделения и комментарии. Не используется для отдельных заметок из фрагментов. Пусто — заголовок и свойства книги без шаблона."))
      .addText((t) => t
        .setPlaceholder(__ertr("Templates/Шаблон.md"))
        .setValue(this.plugin.settings.bookNoteTemplate || "")
        .onChange(async (v) => {
          this.plugin.settings.bookNoteTemplate = v.trim();
          await this.plugin.saveAll();
        }));
    new Setting(c)
      .setName(__ertr("Прогресс в свойствах заметки книги"))
      .setDesc(__ertr("Дописывает в заметку книги свойства reading-progress (процент) и reading-updated (дата). Это те же цифры, что и в файле прогресса, — просто в виде, который понимают Bases: по ним можно строить таблицы и сортировать. Сама заметка больше ничем не трогается."))
      .addToggle((t) => t.setValue(this.plugin.settings.progressToFrontmatter === true).onChange(async (v) => {
        this.plugin.settings.progressToFrontmatter = v;
        await this.plugin.saveAll();
      }));
    tpl.settingEl.addClass("er-set-stacked");
    c.createEl("h3", { text: __ertr("Шаблон") });
    new Setting(c)
      .setName(__ertr("Шаблон заметки"))
      .setDesc(__ertr("Путь к вашему шаблону (Templater), который применяется к новой заметке из выделения. Пусто — заметка создаётся без шаблона, только с цитатой. Пример: 0. Files/4. Templates/Шаблон стандартный.md"))
      .addText((t) => t.setPlaceholder(__ertr("Templates/Шаблон.md")).setValue(this.plugin.settings.noteTemplate || "").onChange(async (v) => {
        this.plugin.settings.noteTemplate = v.trim();
        await this.plugin.saveAll();
      }));
    new Setting(c)
      .setName(__ertr("Сохранять «Что нового» заметкой"))
      .setDesc(__ertr("После обновления плагина в хранилище появляется заметка со списком изменений — рядом с остальными заметками читалки. Окно «Что нового» показывается один раз, а заметка остаётся."))
      .addToggle((t) => t.setValue(this.plugin.settings.whatsNewNote !== false).onChange(async (v) => {
        this.plugin.settings.whatsNewNote = v;
        await this.plugin.saveAll();
      }));
    c.createEl("div", { cls: "er-set-note", text: __ertr("Совет: шаблон можно переопределить для отдельной книги — откройте книгу, нажмите (i) вверху и укажите свой шаблон в поле «Шаблон для этой книги» (удобно, если у разных жанров разное оформление).") });  }
  // ── Перевод ───────────────────────────────────────────────────────────────
  _tabTranslate(c) {
    new Setting(c)
      .setName(__ertr("Разбор фрагмента через ИИ"))
      .setDesc(__ertr("Добавляет к выделению кнопку ✨: открывает разговор о выделенном куске. Одним тапом можно попросить разбор — перевод, трудные слова, обороты, этимология, — а можно просто спросить своими словами и продолжить расспрашивать. Сам ничего не спрашивает: фрагмент уходит на выбранный вами сервис только по вашему сообщению. Выключено, пока вы это не настроите."))
      .addToggle((t) => t.setValue(this.plugin.settings.aiEnabled === true).onChange(async (v) => {
        this.plugin.settings.aiEnabled = v;
        await this.plugin.saveAll();
        this.display();
      }));
    if (this.plugin.settings.aiEnabled) {
      this._group(c, {
        name: __ertr("Куда обращаться за разбором"),
        desc: __ertr("Сервис, ключ и модель. Локальная модель работает без ключа и не отправляет текст в интернет."),
        build: (b, redraw) => this._groupAi(b, redraw),
      });
    }
    new Setting(c)
      .setName(__ertr("Кнопка перевода в выделении"))
      .setDesc(__ertr("Добавляет кнопку перевода в панельку, которая появляется при выделении текста. Перевод открывается рядом с оригиналом, его можно скопировать или сохранить в заметку под цитатой. Откройте книгу заново, чтобы кнопка появилась."))
      .addToggle((t) => t.setValue(this.plugin.settings.translateEnabled === true).onChange(async (v) => {
        this.plugin.settings.translateEnabled = v;
        await this.plugin.saveAll();
        if (v) new Notice(__ertr("Это первая версия функции. Перевод идёт через бесплатный Google Translate: нужен интернет, есть лимиты на частые запросы, а выделенный фрагмент уходит на серверы Google. Для больших объёмов пока не рассчитано."), 1e4);
      }));
    new Setting(c)
      .setName(__ertr("Переводить на язык"))
      .setDesc(__ertr("Язык, на который переводить выделенный фрагмент. Исходный язык определяется автоматически."))
      .addDropdown((d) => d
        .addOption("ru", __ertr("Русский"))
        .addOption("en", "English")
        .addOption("de", "Deutsch")
        .addOption("fr", "Français")
        .addOption("es", "Español")
        .setValue(this.plugin.settings.translateTo || "zh-CN")
        .onChange(async (v) => { this.plugin.settings.translateTo = v; await this.plugin.saveAll(); }));
    c.createEl("div", { cls: "er-set-note", text: __ertr("Перевод — это отдельный сетевой запрос к Google. Если вам важно, чтобы текст книги никуда не уходил, оставьте функцию выключенной: всё остальное в читалке работает полностью офлайн.") });
  }
  // ── Данные ────────────────────────────────────────────────────────────────
  _tabData(c) {
    new Setting(c).setName(__ertr("Папка с книгами")).setDesc(__ertr("Пусто = весь vault")).addText((t) => {
      t.setPlaceholder("0. Files/3. PDF-files").setValue(this.plugin.settings.booksFolder);
      attachPathInput(this.app, t, async (v) => {
        this.plugin.settings.booksFolder = v;
        await this.plugin._saveLocalData();
        await this.plugin.saveAll();
      });
    });
    new Setting(c)
      .setName(__ertr("Папка данных чтения"))
      .setDesc(__ertr("Где хранятся прогресс чтения, выделения и резервные копии (reading-progress.json, reading-highlights.json). Пусто — рядом с книгами (в «Папке с книгами»). Файлы синхронизируются вместе с хранилищем."))
      .addText((t) => { t.setPlaceholder(__ertr("Рядом с книгами")).setValue(this.plugin.settings.dataFolder || "");
        attachPathInput(this.app, t, async (v) => {
          this.plugin.settings.dataFolder = v;
          await this.plugin._saveLocalData();
          await this.plugin.saveAll();
        }); });

    c.createEl("h3", { text: __ertr("Синхронизация между устройствами") });
    const syncInfo = c.createEl("div", { cls: "er-set-note" });
    const progPath = this.plugin._progressFilePath();
    const hlPath = this.plugin._highlightsFilePath();
    // Built as nodes rather than as a string. The two paths come from the
    // user's own settings, and pasting them into markup meant a folder named
    // with a stray angle bracket was parsed as HTML rather than shown. Text
    // nodes cannot be misread as markup, whatever the folder is called.
    {
      const line = (parts) => {
        const d = syncInfo.createDiv();
        for (const p of parts) {
          if (typeof p === "string") d.appendText(p);
          else d.createEl(p.tag, { text: p.text });
        }
        return d;
      };
      line([
        { tag: "span", text: __ertr("Прогресс чтения и выделения хранятся ") },
        { tag: "b", text: __ertr("файлами прямо в хранилище") },
        __ertr(", рядом с книгами:"),
      ]);
      for (const path of [progPath, hlPath]) line(["• ", { tag: "code", text: path }]);
      line([
        __ertr("Поэтому они переезжают между ПК и телефоном "),
        { tag: "b", text: __ertr("любым") },
        __ertr(" способом, которым вы синхронизируете само хранилище (Obsidian Sync, iCloud, Google Drive, Remotely Save и т.п.). Привязка к месту — по номеру абзаца, так что ПК и телефон находят одну и ту же точку при любом размере экрана."),
      ]);
      line([
        __ertr("Настройки оформления и кэш обложек — локальные (в "),
        { tag: "code", text: "data.json" },
        __ertr(" плагина) и намеренно не синхронизируются."),
      ]);
    }
    new Setting(c)
      .setName(__ertr("Способ синхронизации"))
      .setDesc(__ertr("Подсказывает плагину, насколько свежо перечитывать файлы прогресса при открытии книги."))
      .addDropdown((d) => d
        .addOption("auto", __ertr("Авто (рекомендуется)"))
        .addOption("obsidian", "Obsidian Sync")
        .addOption("remotely", "Remotely Save / self-hosted")
        .addOption("cloud", __ertr("iCloud / Google Drive / папка"))
        .addOption("none", __ertr("Без синхронизации"))
        .setValue(this.plugin.settings.syncMode || "auto")
        .onChange(async (v) => {
          this.plugin.settings.syncMode = v;
          await this.plugin.saveAll();
          this._redraw();
        }));
    if (this.plugin.settings.syncMode === "cloud") {
      c.createEl("div", { cls: "er-set-note", text: __ertr("Облачные папки (iCloud/Drive) обновляются с задержкой. Если на одном устройстве вы только читаете — конфликтов не будет: плагин перечитывает прогресс при каждом открытии книги и аккуратно сливает выделения.") });
    }

    c.createEl("h3", { text: __ertr("Очистка") });
    const thumbSet = new Setting(c).setName(__ertr("Кэш обложек")).setDesc(__ertr("Сохранено: {0}", (Object.keys(this.plugin.thumbCache).length))).addButton((b) => b.setButtonText(__ertr("Очистить")).onClick(async () => {
      this.plugin.thumbCache = {};
      await this.plugin._saveThumbCache();
      new Notice(__ertr("Кэш очищен"));
      thumbSet.setDesc(__ertr("Сохранено: {0}", 0));
    }));
    const progSet = new Setting(c).setName(__ertr("Прогресс")).setDesc(__ertr("Книг: {0}", (Object.keys(this.plugin.progress).length))).addButton((b) => b.setButtonText(__ertr("Очистить")).setWarning().onClick(async () => {
      this.plugin.progress = {};
      await this.plugin.saveAll();
      new Notice(__ertr("Прогресс очищен"));
      progSet.setDesc(__ertr("Книг: {0}", 0));
    }));
    const hlCount = Object.values(this.plugin.highlights).reduce((s, a) => s + (Array.isArray(a) ? a.length : 0), 0);
    const hlSet = new Setting(c).setName(__ertr("Выделения")).setDesc(__ertr("Всего: {0}", (hlCount))).addButton((b) => b.setButtonText(__ertr("Очистить все")).setWarning().onClick(async () => {
      this.plugin.highlights = {};
      await this.plugin._saveHighlightsToVault();
      new Notice(__ertr("Выделения очищены"));
      hlSet.setDesc(__ertr("Всего: {0}", 0));
    }));
    // What the reader remembers ABOUT each book, as opposed to their progress in
    // it: which note it's linked to, its category, its template override, and
    // whether the setup screen has already been shown. None of the buttons above
    // touch any of that — so "I cleared everything and it still won't ask me
    // again" was a real dead end (and the only way out was renaming the file).
    const memCount = () => {
      const s = this.plugin.settings;
      return new Set([].concat(
        Object.keys(s.bookNoteLinks || {}),
        Object.keys(s.bookNotePrompted || {}),
        Object.keys(s.bookTags || {}),
        Object.keys(s.bookTemplates || {})
      )).size;
    };
    const memSet = new Setting(c)
      .setName(__ertr("Память о книгах"))
      .setDesc(__ertr("Книг: {0}. Привязанные заметки, категории, шаблоны отдельных книг и отметки «про заметку уже спрашивали». Сами заметки НЕ удаляются — читалка просто забывает связи и спросит про заметку заново при открытии каждой книги.", memCount()));
    let armed = false;
    memSet.addButton((b) => b.setButtonText(__ertr("Забыть все книги")).setWarning().onClick(async () => {
      // Two taps: this wipes links the reader made by hand, and an accidental
      // click would mean re-linking every book.
      if (!armed) {
        armed = true;
        b.setButtonText(__ertr("Точно забыть?"));
        window.setTimeout(() => { if (armed) { armed = false; b.setButtonText(__ertr("Забыть все книги")); } }, 4e3);
        return;
      }
      armed = false;
      b.setButtonText(__ertr("Забыть все книги"));
      const s = this.plugin.settings;
      s.bookNoteLinks = {};
      s.bookNotePrompted = {};
      s.bookTags = {};
      s.bookTemplates = {};
      await this.plugin.saveAll();
      new Notice(__ertr("Готово — читалка снова спросит про заметку при открытии книги"));
      memSet.setDesc(__ertr("Книг: {0}. Привязанные заметки, категории, шаблоны отдельных книг и отметки «про заметку уже спрашивали». Сами заметки НЕ удаляются — читалка просто забывает связи и спросит про заметку заново при открытии каждой книги.", 0));
    }));
  }
  // ── О плагине ─────────────────────────────────────────────────────────────
  _tabAbout(c) {
    // The language picker used to live here, at the bottom of the last tab.
    // It now sits above the tab bar, visible from every screen — see display().
    new Setting(c)
      .setName(__ertr("Пожелания и ошибки"))
      .setDesc(__ertr("Сообщите об ошибке или предложите функцию — мы ответим в GitHub."))
      .addButton((b) => b.setCta().setButtonText(__ertr("Открыть GitHub Issues")).onClick(() => {
        window.open("https://github.com/joeseesun/qiaomu-book-reader/issues", "_blank");
      }));
    new Setting(c)
      .setName(__ertr("Инструкция по плагину"))
      .setDesc(__ertr("21 экран с объяснением: форматы, выделения, заметка книги, синхронизация, а затем разбор каждой настройки — что делает, что выбрать и что будет, если не трогать."))
      .addButton((b) => b.setButtonText(__ertr("Открыть инструкцию")).onClick(() => new OnboardingModal(this.app, this.plugin).open()));
    new Setting(c)
      .setName(__ertr("Что нового"))
      .setDesc(__ertr("Список изменений последних версий."))
      .addButton((b) => b.setButtonText(__ertr("Показать")).onClick(() => {
        new WhatsNewModal(this.app, this.plugin, WHATS_NEW.slice(0, 4)).open();
      }));
    const about = c.createEl("div", { cls: "er-set-note" });
    about.createEl("b", { text: "Qiaomu Book Reader" });
    about.appendText(__ertr(" — версия {0}. Автор: 向阳乔木。", this.plugin.manifest.version));
    about.createEl("br");
    about.createEl("a", { text: "qiaomu.ai", href: "https://qiaomu.ai" });
    about.appendText(" · ");
    about.createEl("a", { text: "X @vista8", href: "https://x.com/vista8" });
    about.appendText(" · ");
    about.createEl("a", { text: "GitHub @joeseesun", href: "https://github.com/joeseesun" });
    about.createEl("br");
    about.appendText(__ertr("Основано на Elton Reader; спасибо Elton Labs и всем участникам оригинального проекта."));
    about.appendText(" ");
    about.createEl("a", { text: "swayinfo/elton-reader", href: "https://github.com/swayinfo/elton-reader" });
  }
};
export default EltonReader;
