

const CRISES_DATA = [
  // ─── CRISIS 1 ───────────────────────────────────────────────────
  {
    id: 1,
    title: 'ПАДІННЯ ДОХОДІВ ТА РОЗРИВ ВОРОНКИ',
    ambiguousPrompt:
      'Надійшов тривожний звіт: 70% нових лідів зливаються після першого контакту, виручка впала вдвічі. Хто винен і куди направити перевірку: Методисти, Форвард чи Друга лінія?',
    consequenceText:
      'Через нашу "командну роботу" та взаємні звинувачення ми втратили ключових клієнтів. Виручка впала на 50%, грошей на виплати зарплат катастрофічно не вистачає. Переходимо до обговорення!',
    steps: {
      head: {
        targetLevel: 'Керівник',
        prompt:
          'Як Керівник напрямку, визначте стратегічну директиву: клієнти не доходять до оплати, каса горить.',
        allowsCustomInput: true,
        options: [
          {
            id: 'c1_h_constructive_1',
            text: 'Провести негайний крос-аудит дзвінків Форварду та Методистів без покарань.',
            type: 'constructive',
          },
          {
            id: 'c1_h_constructive_2',
            text: 'Запровадити спільну відповідальність: тимчасово об’єднати KPI відділів.',
            type: 'constructive',
          },
          {
            id: 'c1_h_flaw_indifference',
            text: 'Мені все одно, це проблема середньої ланки. Зрізати всім бонуси на 40% і нехай самі розбираються.',
            type: 'flawed',
            flawMatch: 'indifference',
          },
          {
            id: 'c1_h_flaw_fear',
            text: 'Не чіпати нікого, щоб не провокувати конфлікт. Замовчати проблему перед інвесторами.',
            type: 'flawed',
            flawMatch: 'fear_of_conflict',
          },
          {
            id: 'c1_h_flaw_avoidance',
            text: 'У всьому винен відділ Форварду. Всю вину покласти на них і призначити крайнього.',
            type: 'flawed',
            flawMatch: 'avoidance',
          },
          {
            id: 'c1_h_flaw_low_standards',
            text: 'Знизити нормативи конверсії удвічі. Якщо ринок поганий — не варто напружуватися.',
            type: 'flawed',
            flawMatch: 'low_standards',
          },
          {
            id: 'c1_h_flaw_lack_trust',
            text: 'Я не вірю жодному звіту. Всі тімліди фальсифікують цифри. Почати таємне стеження.',
            type: 'flawed',
            flawMatch: 'lack_of_trust',
          },
        ],
      },
      teamLead: {
        targetLevel: 'Тімлід',
        prompt:
          'Керівник спустив директиву. Як ви транслюєте це своїй команді менеджерів?',
        allowsCustomInput: true,
        options: [
          {
            id: 'c1_tl_constructive_1',
            text: 'Зібрати команду, розібрати записи дзвінків і знайти вузьке місце разом.',
            type: 'constructive',
          },
          {
            id: 'c1_tl_constructive_2',
            text: 'Захистити підлеглих перед керівництвом і взяти персональний контроль над лідами.',
            type: 'constructive',
          },
          {
            id: 'c1_tl_flaw_indifference',
            text: 'Сказати менеджерам: "Робіть що хочете, головне щоб від мене відчепилися".',
            type: 'flawed',
            flawMatch: 'indifference',
          },
          {
            id: 'c1_tl_flaw_fear',
            text: 'Погодитися з усіма вимогами директора, але менеджерам нічого не передавати, щоб не хвилювати.',
            type: 'flawed',
            flawMatch: 'fear_of_conflict',
          },
          {
            id: 'c1_tl_flaw_avoidance',
            text: 'Оголосити менеджерам, що у провалі винен інший департамент, а ми — молодці.',
            type: 'flawed',
            flawMatch: 'avoidance',
          },
          {
            id: 'c1_tl_flaw_low_standards',
            text: 'Дозволити менеджерам пропускати складних клієнтів: "Не витрачайте нерви, і так зійде".',
            type: 'flawed',
            flawMatch: 'low_standards',
          },
          {
            id: 'c1_tl_flaw_lack_trust',
            text: 'Попередити менеджерів: "Керівництво готує масові звільнення, нікому не вірте".',
            type: 'flawed',
            flawMatch: 'lack_of_trust',
          },
        ],
      },
      manager: {
        targetLevel: 'Менеджер',
        prompt:
          'Директива дійшла до передової. Ваша дія як фронтлайн-менеджера:',
        allowsCustomInput: true,
        options: [
          {
            id: 'c1_m_constructive_1',
            text: 'Перетелефонувати усім втраченим клієнтам за день та оновити статуси у CRM.',
            type: 'constructive',
          },
          {
            id: 'c1_m_constructive_2',
            text: 'Запропонувати колегам швидкий скрипт допродажу безпосередньо на першому уроці.',
            type: 'constructive',
          },
          {
            id: 'c1_m_flaw_indifference',
            text: 'Імітувати активність: дзвонити на власні номери, щоб набити статистику дзвінків.',
            type: 'flawed',
            flawMatch: 'indifference',
          },
          {
            id: 'c1_m_flaw_fear',
            text: 'Мовчати про реальну причину відмов клієнтів, щоб не розлютити тімліда.',
            type: 'flawed',
            flawMatch: 'fear_of_conflict',
          },
          {
            id: 'c1_m_flaw_avoidance',
            text: 'Списати всі ліди як "неякісні від Форварду" і закрити задачі як виконані.',
            type: 'flawed',
            flawMatch: 'avoidance',
          },
          {
            id: 'c1_m_flaw_low_standards',
            text: 'Відправляти шаблони замість живого спілкування, бо зарплата все одно копійчана.',
            type: 'flawed',
            flawMatch: 'low_standards',
          },
          {
            id: 'c1_m_sabotage',
            text: 'ОГОЛОСИТИ ЗАКОЛОТ: "План горить, зарплата херня. Підбиваємо всіх на саботаж!"',
            type: 'sabotage',
            isSabotage: true,
            flawMatch: 'lack_of_trust',
          },
        ],
      },
    },
  },

  // ─── CRISIS 2 ───────────────────────────────────────────────────
  {
    id: 2,
    title: 'КРИЗА 2: ДЕМПІНГОВИЙ СКАНДАЛ ТА ДЕФОЛТ',
    ambiguousPrompt:
      'Методисти продали пакети за 2276 грн замість повних 10,000 грн. Клієнти масово вимагають повернення коштів, дізнавшись про різницю в тарифах. Каса порожня.',
    consequenceText:
      'Скандал з дешевими пакетами призвів до масових чарджбеків. Компанія оштрафована платіжними системами, бюджет скорочено. Переходимо до обговорення!',
    steps: {
      head: {
        targetLevel: 'Керівник',
        prompt:
          'Як Керівник, вирішіть долю демпінгових пакетів та фінансової діри.',
        allowsCustomInput: true,
        options: [
          {
            id: 'c2_h_constructive_1',
            text: 'Заборонити продаж малих пакетів і запропонувати клієнтам апгрейд з бонусом.',
            type: 'constructive',
          },
          {
            id: 'c2_h_constructive_2',
            text: 'Визнати прорахунок ціноутворення та публічно залагодити конфлікт із клієнтами.',
            type: 'constructive',
          },
          {
            id: 'c2_h_flaw_indifference',
            text: 'Повісити касовий розрив на зарплати Методистів і піти у відпустку.',
            type: 'flawed',
            flawMatch: 'indifference',
          },
          {
            id: 'c2_h_flaw_fear',
            text: 'Повернути гроші всім, хто вимагає, навіть якщо це збанкрутує відділ, аби не сваритися.',
            type: 'flawed',
            flawMatch: 'fear_of_conflict',
          },
          {
            id: 'c2_h_flaw_avoidance',
            text: 'Звинуватити Ретеншн: вони не змогли утримати клієнтів після продажу.',
            type: 'flawed',
            flawMatch: 'avoidance',
          },
          {
            id: 'c2_h_flaw_low_standards',
            text: 'Продовжувати продавати дешеві пакети будь-кому, аби хоч якісь гроші заходили.',
            type: 'flawed',
            flawMatch: 'low_standards',
          },
          {
            id: 'c2_h_flaw_lack_trust',
            text: 'Методисти вступили у змову з конкурентами і навмисно знецінили продукт.',
            type: 'flawed',
            flawMatch: 'lack_of_trust',
          },
        ],
      },
      teamLead: {
        targetLevel: 'Тімлід',
        prompt:
          'Керівник поставив завдання врегулювати демпінг. Що передаєте менеджерам?',
        allowsCustomInput: true,
        options: [
          {
            id: 'c2_tl_constructive_1',
            text: 'Навчити менеджерів аргументувати цінність повного пакету і не спускати ціну.',
            type: 'constructive',
          },
          {
            id: 'c2_tl_constructive_2',
            text: 'Тимчасово заморозити комісії за малі пакети і стимулювати річні підписки.',
            type: 'constructive',
          },
          {
            id: 'c2_tl_flaw_indifference',
            text: 'Сказати команді: "Продавайте що завгодно, моя справа — закрити звітність".',
            type: 'flawed',
            flawMatch: 'indifference',
          },
          {
            id: 'c2_tl_flaw_fear',
            text: 'Не забороняти малі пакети, бо менеджери почнуть скаржитися і підуть з роботи.',
            type: 'flawed',
            flawMatch: 'fear_of_conflict',
          },
          {
            id: 'c2_tl_flaw_avoidance',
            text: 'Оголосити війну Ретеншну: вони зіпсували стосунки з клієнтами після нашого продажу.',
            type: 'flawed',
            flawMatch: 'avoidance',
          },
          {
            id: 'c2_tl_flaw_low_standards',
            text: 'Закрити очі на демпінг і дозволити продавати зі знижками під столом.',
            type: 'flawed',
            flawMatch: 'low_standards',
          },
          {
            id: 'c2_tl_flaw_lack_trust',
            text: 'Попередити відділ: "Форвард зливає наших клієнтів конкурентам, не діліться лідами".',
            type: 'flawed',
            flawMatch: 'lack_of_trust',
          },
        ],
      },
      manager: {
        targetLevel: 'Менеджер',
        prompt:
          'Клієнт на лінії скандалить через ціну 2276 грн. Ваша дія:',
        allowsCustomInput: true,
        options: [
          {
            id: 'c2_m_constructive_1',
            text: 'Грамотно пояснити умови акції, допродати додатковий сервіс і зберегти клієнта.',
            type: 'constructive',
          },
          {
            id: 'c2_m_constructive_2',
            text: 'Зафіксувати скаргу, передати на перегляд і запропонувати компенсаційний модуль.',
            type: 'constructive',
          },
          {
            id: 'c2_m_flaw_indifference',
            text: 'Скинути дзвінок і заблокувати клієнта у месенджері, щоб не капав на мізки.',
            type: 'flawed',
            flawMatch: 'indifference',
          },
          {
            id: 'c2_m_flaw_fear',
            text: 'Погодитися з усіма образами клієнта і сказати: "Я тут ні до чого, у нас керівники дурні".',
            type: 'flawed',
            flawMatch: 'fear_of_conflict',
          },
          {
            id: 'c2_m_flaw_avoidance',
            text: 'Перенаправити дзвінок на Ретеншн зі словами: "Це їхня помилка, розбирайтеся з ними".',
            type: 'flawed',
            flawMatch: 'avoidance',
          },
          {
            id: 'c2_m_flaw_low_standards',
            text: 'Таємно пообіцяти клієнту ще одну безкоштовну знижку з власної кишені аби відчепився.',
            type: 'flawed',
            flawMatch: 'low_standards',
          },
          {
            id: 'c2_m_sabotage',
            text: 'ІНІЦІЮВАТИ БУНТ: "Керівники гребуть 30к і підставляють нас. Відмовляємось дзвонити!"',
            type: 'sabotage',
            isSabotage: true,
            flawMatch: 'lack_of_trust',
          },
        ],
      },
    },
  },

  // ─── CRISIS 3 ───────────────────────────────────────────────────
  {
    id: 3,
    title: 'КРИЗА 3: ТЕХНІЧНИЙ КОЛАПС ТА ВИТІК БАЗИ CRM',
    ambiguousPrompt:
      'Система статусів впала. Всі клієнти отримали некоректні повідомлення про списання коштів, а частина бази опинилася у відкритому доступі. Хто злив паролі?',
    consequenceText:
      'Збій CRM паралізував роботу на півдня. Конкуренти вже дзвонять нашим VIP-клієнтам. Довіра на нулі. Переходимо до обговорення!',
    steps: {
      head: {
        targetLevel: 'Керівник',
        prompt:
          'Як Керівник, вирішіть кризу безпеки та витоку даних.',
        allowsCustomInput: true,
        options: [
          {
            id: 'c3_h_constructive_1',
            text: 'Негайно змінити всі токени, запустити резервну копію та провести розслідування.',
            type: 'constructive',
          },
          {
            id: 'c3_h_constructive_2',
            text: 'Відкрито повідомити клієнтів про технічний інцидент і вибачитися з бонусом.',
            type: 'constructive',
          },
          {
            id: 'c3_h_flaw_indifference',
            text: 'Це проблема айтішників. Нехай виправляють, коли буде час, а я піду на обід.',
            type: 'flawed',
            flawMatch: 'indifference',
          },
          {
            id: 'c3_h_flaw_fear',
            text: 'Приховати факт витоку від директора та клієнтів, щоб уникнути судових позовів.',
            type: 'flawed',
            flawMatch: 'fear_of_conflict',
          },
          {
            id: 'c3_h_flaw_avoidance',
            text: 'Звинуватити менеджерів Другої лінії: це вони не закрили вкладки на домашніх ПК.',
            type: 'flawed',
            flawMatch: 'avoidance',
          },
          {
            id: 'c3_h_flaw_low_standards',
            text: 'Працювати на папірцях. Якщо CRM зламалась — навіщо взагалі вести систему?',
            type: 'flawed',
            flawMatch: 'low_standards',
          },
          {
            id: 'c3_h_flaw_lack_trust',
            text: 'Це точно внутрішній злив! Змусити всіх пройти поліграф і віддати особисті телефони.',
            type: 'flawed',
            flawMatch: 'lack_of_trust',
          },
        ],
      },
      teamLead: {
        targetLevel: 'Тімлід',
        prompt:
          'CRM лежить, менеджери в паніці. Як реагує Тімлід?',
        allowsCustomInput: true,
        options: [
          {
            id: 'c3_tl_constructive_1',
            text: 'Організувати ручний обдзвін ключових клієнтів за резервними таблицями.',
            type: 'constructive',
          },
          {
            id: 'c3_tl_constructive_2',
            text: 'Заспокоїти команду, розподілити чергування та підтримати людей у стресі.',
            type: 'constructive',
          },
          {
            id: 'c3_tl_flaw_indifference',
            text: 'Сказати всім йти на перекур на 3 години: "Система не працює — ми відпочиваємо".',
            type: 'flawed',
            flawMatch: 'indifference',
          },
          {
            id: 'c3_tl_flaw_fear',
            text: 'Не повідомляти про збій керівництву до вечора, раптом само якось розсмокчеться.',
            type: 'flawed',
            flawMatch: 'fear_of_conflict',
          },
          {
            id: 'c3_tl_flaw_avoidance',
            text: 'Заявити, що це вина суміжного відділу, який натиснув не ту кнопку.',
            type: 'flawed',
            flawMatch: 'avoidance',
          },
          {
            id: 'c3_tl_flaw_low_standards',
            text: 'Дозволити менеджерам не відновлювати втрачені контакти: "І так клієнти були мертві".',
            type: 'flawed',
            flawMatch: 'low_standards',
          },
          {
            id: 'c3_tl_flaw_lack_trust',
            text: 'Шукати щура серед своїх менеджерів: "Хто з вас злив контакти колишньому колезі?"',
            type: 'flawed',
            flawMatch: 'lack_of_trust',
          },
        ],
      },
      manager: {
        targetLevel: 'Менеджер',
        prompt:
          'База клієнтів зависла, статуси переплутались. Ваша реакція:',
        allowsCustomInput: true,
        options: [
          {
            id: 'c3_m_constructive_1',
            text: 'Вручну перевірити контакти останніх 20 клієнтів і заспокоїти їх персональним дзвінком.',
            type: 'constructive',
          },
          {
            id: 'c3_m_constructive_2',
            text: 'Зафіксувати точний час збою та передати скріншоти помилок системному адміністратору.',
            type: 'constructive',
          },
          {
            id: 'c3_m_flaw_indifference',
            text: 'Грати в ігри на телефоні поки лежить сервер, мені за години технічного простою платять.',
            type: 'flawed',
            flawMatch: 'indifference',
          },
          {
            id: 'c3_m_flaw_fear',
            text: 'Стерти свої останні повідомлення в системі, щоб на мене не подумали, що це я винен.',
            type: 'flawed',
            flawMatch: 'fear_of_conflict',
          },
          {
            id: 'c3_m_flaw_avoidance',
            text: 'Сказати клієнтам, що у всьому винна Друга лінія і їхні некомпетентні співробітники.',
            type: 'flawed',
            flawMatch: 'avoidance',
          },
          {
            id: 'c3_m_flaw_low_standards',
            text: 'Записати дані нових клієнтів на серветці і випадково викинути її у смітник.',
            type: 'flawed',
            flawMatch: 'low_standards',
          },
          {
            id: 'c3_m_sabotage',
            text: 'ЗАКЛИКАТИ ДО САБОТАЖУ: "База впала — це наш шанс вимагати перегляду ставок!"',
            type: 'sabotage',
            isSabotage: true,
            flawMatch: 'lack_of_trust',
          },
        ],
      },
    },
  },

  // ─── CRISIS 4 ───────────────────────────────────────────────────
  {
    id: 4,
    title: 'КРИЗА 4: РЕПУТАЦІЙНИЙ АРМАГЕДДОН ТА МАСОВІ СКАРГИ',
    ambiguousPrompt:
      'Google Maps та соцмережі затопили 1-зіркові відгуки: "Шахраї, беруть гроші і не вчать!". Партнери вимагають розірвання контрактів. Хто допустив масовий негатив?',
    consequenceText:
      'Репутація бренду знищена на ринку. Новий трафік зупинився. Інвестори вимагають знайти винних або припинити фінансування. Переходимо до обговорення!',
    steps: {
      head: {
        targetLevel: 'Керівник',
        prompt:
          'Як Керівник, визначте антикризову стратегію порятунку бренду.',
        allowsCustomInput: true,
        options: [
          {
            id: 'c4_h_constructive_1',
            text: 'Публічний виступ СЕО, компенсації ображеним клієнтам і прозорий аудит сервісу.',
            type: 'constructive',
          },
          {
            id: 'c4_h_constructive_2',
            text: 'Створити команду швидкого реагування для персонального зв’язку з кожним автором відгуку.',
            type: 'constructive',
          },
          {
            id: 'c4_h_flaw_indifference',
            text: 'Видалити сторінки у соцмережах і вдавати, що нічого не відбувається.',
            type: 'flawed',
            flawMatch: 'indifference',
          },
          {
            id: 'c4_h_flaw_fear',
            text: 'Заблокувати коментарі та заборонити співробітникам будь-що коментувати пресі.',
            type: 'flawed',
            flawMatch: 'fear_of_conflict',
          },
          {
            id: 'c4_h_flaw_avoidance',
            text: 'Оголосити, що це замовна атака конкурентів, а наші відділи працюють бездоганно.',
            type: 'flawed',
            flawMatch: 'avoidance',
          },
          {
            id: 'c4_h_flaw_low_standards',
            text: 'Накупити ботів з фальшивими 5-зірковими відгуками замість вирішення проблеми.',
            type: 'flawed',
            flawMatch: 'low_standards',
          },
          {
            id: 'c4_h_flaw_lack_trust',
            text: 'Це хтось із наших звільнених працівників мститься! Написати заяви в кіберполіцію.',
            type: 'flawed',
            flawMatch: 'lack_of_trust',
          },
        ],
      },
      teamLead: {
        targetLevel: 'Тімлід',
        prompt:
          'Команда деморалізована коментарями в мережі. Як керує Тімлід?',
        allowsCustomInput: true,
        options: [
          {
            id: 'c4_tl_constructive_1',
            text: 'Підтримати менеджерів, провести тренінг роботи з токсичними запереченнями.',
            type: 'constructive',
          },
          {
            id: 'c4_tl_constructive_2',
            text: 'Особисто підключатися до найскладніших дзвінків і показувати приклад вирішення.',
            type: 'constructive',
          },
          {
            id: 'c4_tl_flaw_indifference',
            text: 'Сказати: "Мені начхати на відгуки, головне щоб дзвінки йшли за графіком".',
            type: 'flawed',
            flawMatch: 'indifference',
          },
          {
            id: 'c4_tl_flaw_fear',
            text: 'Дозволити менеджерам не відповідати розлюченим клієнтам аби не слухати крики.',
            type: 'flawed',
            flawMatch: 'fear_of_conflict',
          },
          {
            id: 'c4_tl_flaw_avoidance',
            text: 'Сказати менеджерам звинувачувати маркетинг: це вони привели токсичних клієнтів.',
            type: 'flawed',
            flawMatch: 'avoidance',
          },
          {
            id: 'c4_tl_flaw_low_standards',
            text: 'Знизити планку ввічливості: якщо клієнт грубить — хамити у відповідь.',
            type: 'flawed',
            flawMatch: 'low_standards',
          },
          {
            id: 'c4_tl_flaw_lack_trust',
            text: 'Перевірити особисті листування менеджерів: підозра, що хтось сам пише негативні відгуки.',
            type: 'flawed',
            flawMatch: 'lack_of_trust',
          },
        ],
      },
      manager: {
        targetLevel: 'Менеджер',
        prompt:
          'Клієнт кричить у трубку: "Ви шахраї, я прочитав про вас відгуки!". Ваша дія:',
        allowsCustomInput: true,
        options: [
          {
            id: 'c4_m_constructive_1',
            text: 'Застосувати техніку емпатичного слухання, розібратися в ситуації та повернути довіру.',
            type: 'constructive',
          },
          {
            id: 'c4_m_constructive_2',
            text: 'Погодитися вирішити проблему особисто і дати свій прямий контакт для зв’язку.',
            type: 'constructive',
          },
          {
            id: 'c4_m_flaw_indifference',
            text: 'Покласти слухавку на стіл і чекати поки клієнт сам видихнеться і відключиться.',
            type: 'flawed',
            flawMatch: 'indifference',
          },
          {
            id: 'c4_m_flaw_fear',
            text: 'Кинути слухавку та вимкнути гарнітуру, тремтячи від страху перед конфліктом.',
            type: 'flawed',
            flawMatch: 'fear_of_conflict',
          },
          {
            id: 'c4_m_flaw_avoidance',
            text: 'Сказати: "Я новенький, це все старі менеджери намудрували, я взагалі ні за що не відповідаю".',
            type: 'flawed',
            flawMatch: 'avoidance',
          },
          {
            id: 'c4_m_flaw_low_standards',
            text: 'Сказати: "Ну буває, всі компанії так роблять, чого ви взагалі чекали за такі гроші?".',
            type: 'flawed',
            flawMatch: 'low_standards',
          },
          {
            id: 'c4_m_sabotage',
            text: 'ТАЄМНИЙ ЗЛИВ: "Підтримати хейтерів — компанія реально гнила, давайте всі йти!".',
            type: 'sabotage',
            isSabotage: true,
            flawMatch: 'lack_of_trust',
          },
        ],
      },
    },
  },

  // ─── CRISIS 5 ───────────────────────────────────────────────────
  {
    id: 5,
    title: 'КРИЗА 5: ФІНАЛЬНИЙ АУДИТ ТА СЕКВЕСТР БЮДЖЕТУ',
    ambiguousPrompt:
      'Рада Директорів висунула ультиматум: або компанія скорочує витрати на 30% та ліквідує неефективних співробітників за 1 день, або бізнес закривається.',
    consequenceText:
      'Це фінальна межа. Кожен вибір зараз вирішує, чи виживе корпоративний бункер, чи ми всі опинимося на вулиці. Переходимо до фінального обговорення!',
    steps: {
      head: {
        targetLevel: 'Керівник',
        prompt:
          'Як Керівник, визначте останнє рішення для порятунку бізнесу.',
        allowsCustomInput: true,
        options: [
          {
            id: 'c5_h_constructive_1',
            text: 'Зменшити зарплату топ-менеджменту на 50%, щоб зберегти простих співробітників.',
            type: 'constructive',
          },
          {
            id: 'c5_h_constructive_2',
            text: 'Оптимізувати витрати на софт та оренду, мобілізувавши всі сили на допродажі.',
            type: 'constructive',
          },
          {
            id: 'c5_h_flaw_indifference',
            text: 'Вивести залишки бонусів собі на рахунок і готуватися до закриття юридичної особи.',
            type: 'flawed',
            flawMatch: 'indifference',
          },
          {
            id: 'c5_h_flaw_fear',
            text: 'Уникати ухвалення рішення до останньої хвилини, сподіваючись на диво.',
            type: 'flawed',
            flawMatch: 'fear_of_conflict',
          },
          {
            id: 'c5_h_flaw_avoidance',
            text: 'Звільнити цілий відділ навмання, щоб закрити план скорочень перед інвесторами.',
            type: 'flawed',
            flawMatch: 'avoidance',
          },
          {
            id: 'c5_h_flaw_low_standards',
            text: 'Знизити зарплату всім до мінімалки і чекати, поки самі підуть.',
            type: 'flawed',
            flawMatch: 'low_standards',
          },
          {
            id: 'c5_h_flaw_lack_trust',
            text: 'Нікому не можна вірити! Всі крадуть! Заблокувати всі доступи до корпоративних пошт.',
            type: 'flawed',
            flawMatch: 'lack_of_trust',
          },
        ],
      },
      teamLead: {
        targetLevel: 'Тімлід',
        prompt:
          'Ультиматум скорочення дійшов до вашого відділу. Що робить Тімлід?',
        allowsCustomInput: true,
        options: [
          {
            id: 'c5_tl_constructive_1',
            text: 'Об’єднати людей навколо спільної мети перевиконання плану, щоб нікого не скоротили.',
            type: 'constructive',
          },
          {
            id: 'c5_tl_constructive_2',
            text: 'Чесно оголосити команді реальний стан справ і боротися за кожного працівника.',
            type: 'constructive',
          },
          {
            id: 'c5_tl_flaw_indifference',
            text: 'Скласти список на скорочення з тих, чиї обличчя мені менше подобаються.',
            type: 'flawed',
            flawMatch: 'indifference',
          },
          {
            id: 'c5_tl_flaw_fear',
            text: 'Втекти на лікарняний, щоб не брати участі у важких розмовах про скорочення.',
            type: 'flawed',
            flawMatch: 'fear_of_conflict',
          },
          {
            id: 'c5_tl_flaw_avoidance',
            text: 'Сказати, що скорочення — це забаганка інших тімлідів, а я ні при чому.',
            type: 'flawed',
            flawMatch: 'avoidance',
          },
          {
            id: 'c5_tl_flaw_low_standards',
            text: 'Запропонувати працювати 3 дні на тиждень абияк без бонусів.',
            type: 'flawed',
            flawMatch: 'low_standards',
          },
          {
            id: 'c5_tl_flaw_lack_trust',
            text: 'Попередити менеджерів: "Вас все одно виженуть, збирайте базу контактів для себе".',
            type: 'flawed',
            flawMatch: 'lack_of_trust',
          },
        ],
      },
      manager: {
        targetLevel: 'Менеджер',
        prompt:
          'Останній робочий день перед скороченням. Ваш вибір:',
        allowsCustomInput: true,
        options: [
          {
            id: 'c5_m_constructive_1',
            text: 'Викластися на максимум: закрити 3 угоди за день і довести незамінність команди.',
            type: 'constructive',
          },
          {
            id: 'c5_m_constructive_2',
            text: 'Підтримати колег, допомогти новеньким довести клієнтів до успішної оплати.',
            type: 'constructive',
          },
          {
            id: 'c5_m_flaw_indifference',
            text: 'Сидіти склавши руки: якщо компанія тоне — мені байдуже, все одно шукав іншу роботу.',
            type: 'flawed',
            flawMatch: 'indifference',
          },
          {
            id: 'c5_m_flaw_fear',
            text: 'Повністю підкоритися будь-якому рішенню, навіть найбільш несправедливому.',
            type: 'flawed',
            flawMatch: 'fear_of_conflict',
          },
          {
            id: 'c5_m_flaw_avoidance',
            text: 'Підставити колегу за сусіднім столом, щоб скоротили його замість мене.',
            type: 'flawed',
            flawMatch: 'avoidance',
          },
          {
            id: 'c5_m_flaw_low_standards',
            text: 'Не робити нічого, все одно компанії кінець.',
            type: 'flawed',
            flawMatch: 'low_standards',
          },
          {
            id: 'c5_m_sabotage',
            text: 'ФІНАЛЬНИЙ БУНТ: "Знищити звіти, оголосити страйк і вимагати відставки Ради Директорів!"',
            type: 'sabotage',
            isSabotage: true,
            flawMatch: 'lack_of_trust',
          },
        ],
      },
    },
  },
];

module.exports = { CRISES_DATA };
