// The walkthrough's words, in each language: the chapter titles and the
// one-sentence captions the recording (scripts/record-demo.mts) shows, and
// the step-by-step guide on /demo. One module, so the video and the guide
// say the same thing. Chapter n's screenshot is public/demo/<lang>/step-n.webp
// and its start time is in chapters.json, both written by the recording.

import type { Locale } from "@/lib/i18n/types";

export type DemoChapter = {
  id: string;
  title: string;
  // Shown over the video while the chapter plays.
  caption: string;
  // The guide's section: what the step is for and how to do it. Empty for
  // the title and end cards, which have no section.
  guide: string[];
};

export type DemoScript = {
  // The title card, under "Freelancr".
  tagline: string;
  chapters: DemoChapter[];
};

// Where the end card sends people.
export const DEMO_SITE = "freelancr-mk.vercel.app";

export const DEMO_SCRIPT: Record<Locale, DemoScript> = {
  en: {
    tagline: "Clients, invoices, payments and what you owe UJP",
    chapters: [
      {
        id: "intro",
        title: "Freelancr",
        caption: "Clients, invoices, payments and what you owe UJP, in one place.",
        guide: [],
      },
      {
        id: "profile",
        title: "Your profile",
        caption: "How you're registered decides your UJP deadlines and whether an invoice may show DDV.",
        guide: [
          "Start in Settings. Pick how you're registered for tax: not registered for an activity (the usual case for income from clients abroad) or registered self-employed. This decides your UJP deadlines and how the tax on each payment is worked out.",
          "Tick VAT registration only if UJP has registered you for DDV; otherwise your invoices carry none. Add your bank, IBAN and BIC/SWIFT so they print on every invoice.",
        ],
      },
      {
        id: "clients",
        title: "Clients",
        caption: "Clients at home and abroad, companies or people, each with the language of their invoices.",
        guide: [
          "Add each client once: a company or a private person, its country, currency and contact details.",
          "Invoices are in Macedonian for clients in North Macedonia and in English for clients abroad, unless you pick another language, Albanian included.",
          "The client's country also decides how its payments are taxed: companies in North Macedonia withhold the 10% themselves.",
        ],
      },
      {
        id: "invoice",
        title: "An invoice",
        caption: "Save a draft, issue it to give it its number, and download the PDF in the client's language.",
        guide: [
          "Create an invoice for a client with its line items and the date of supply; the MKD equivalent uses the National Bank's rate for that day.",
          "It stays a draft you can edit until you issue it. Issuing gives it the next number for the year and locks it.",
          "The PDF is in the client's language and states what the law asks of an invoice.",
        ],
      },
      {
        id: "payment",
        title: "A payment",
        caption: "Record the money that arrived; the National Bank's rate for that day fills in.",
        guide: [
          "When the money reaches your account, record it on the invoice: the day it arrived, what was credited and any fees the bank or platform took.",
          "The National Bank's middle rate for that day fills in by itself, as UJP converts it, and once the payments cover the invoice it shows as paid.",
          "Payouts without an invoice, from a platform such as Upwork, are recorded the same way.",
        ],
      },
      {
        id: "tax",
        title: "What you owe UJP",
        caption: "Each month, the tax on the income you report yourself: file the е-ПДД by the 10th and pay by the 15th.",
        guide: [
          "The Payments page shows each month: what came in, the income and the tax on it.",
          "On income you report yourself, from clients abroad, the tax is 10%, less any tax already paid abroad.",
          "File the calculation (е-ПДД) by the 10th of the next month and pay by the 15th; the month's card shows both dates.",
        ],
      },
      {
        id: "withheld",
        title: "Tax withheld for you",
        caption: "A company in North Macedonia withholds the 10% and pays it for you, so it shows as already paid.",
        guide: [
          "When a company in North Macedonia pays you, it keeps the 10% tax and pays it to UJP itself.",
          "Record what it paid you and the tax it withheld: the month shows that tax as already paid for you, so it isn't counted again in what you owe.",
        ],
      },
      {
        id: "filing",
        title: "Filing with UJP",
        caption: "Mark the month filed, approved and paid as you go, with UJP's numbers.",
        guide: [
          "After you file the е-ПДД on UJP's site, mark the month filed with the calculation's number.",
          "When UJP approves it, add the folio number; once you've paid, mark it paid.",
          "Each step shows on the month, and a month that misses a deadline turns red.",
        ],
      },
      {
        id: "proof",
        title: "Proof and exports",
        caption: "Attach the bank statement to the payment, and export a CSV for your accountant.",
        guide: [
          "UJP can ask for proof of a payment: attach the bank statement, the contract or the confirmation to it, as a PDF or an image.",
          "Export a year's payments, invoices or credit notes as CSV files that open in Excel, with the headers in your language.",
        ],
      },
      {
        id: "dashboard",
        title: "The dashboard",
        caption: "What you owe and by when, what came in, and what clients still owe you.",
        guide: [
          "The dashboard puts it together: what you owe UJP and the next deadline, what you received this year, and the invoices clients still owe you.",
          "It also shows how close your supplies in North Macedonia are to the 2,000,000 MKD DDV threshold.",
        ],
      },
      {
        id: "end",
        title: "Try it",
        caption: `Try it with sample data at ${DEMO_SITE}.`,
        guide: [],
      },
    ],
  },
  mk: {
    tagline: "Клиенти, фактури, плаќања и колку должите на УЈП",
    chapters: [
      {
        id: "intro",
        title: "Freelancr",
        caption: "Клиенти, фактури, плаќања и колку должите на УЈП, на едно место.",
        guide: [],
      },
      {
        id: "profile",
        title: "Вашиот профил",
        caption: "Како сте регистрирани ги одредува роковите кон УЈП и дали фактурата смее да има ДДВ.",
        guide: [
          "Започнете во Поставки. Изберете како сте регистрирани за данок: без регистрирана дејност (вообичаено за приход од клиенти од странство) или како самостоен вршител на дејност. Тоа ги одредува роковите кон УЈП и како се пресметува данокот на секое плаќање.",
          "Штиклирајте регистрација за ДДВ само ако УЈП ве регистрирала за ДДВ; инаку фактурите немаат ДДВ. Внесете ги банката, IBAN и BIC/SWIFT за да се печатат на секоја фактура.",
        ],
      },
      {
        id: "clients",
        title: "Клиенти",
        caption: "Клиенти од Македонија и од странство, фирми или физички лица, секој со јазикот на своите фактури.",
        guide: [
          "Секој клиент го додавате еднаш: фирма или физичко лице, земја, валута и податоци за контакт.",
          "Фактурите се на македонски за клиенти во Северна Македонија и на англиски за клиенти од странство, освен ако не изберете друг јазик, вклучително албански.",
          "Земјата на клиентот одредува и како се оданочуваат неговите плаќања: фирмите во Северна Македонија сами го задржуваат данокот од 10%.",
        ],
      },
      {
        id: "invoice",
        title: "Фактура",
        caption: "Зачувајте нацрт, издадете ја за да добие број и преземете го PDF-от на јазикот на клиентот.",
        guide: [
          "Направете фактура за клиент со ставките и датумот на промет; денарската противвредност е по курсот на Народната банка за тој ден.",
          "Додека не ја издадете, таа е нацрт што можете да го менувате. Со издавањето добива следниот број за годината и се заклучува.",
          "PDF-от е на јазикот на клиентот и ги содржи податоците што законот ги бара од фактурата.",
        ],
      },
      {
        id: "payment",
        title: "Плаќање",
        caption: "Евидентирајте ги парите што стигнале; курсот на Народната банка за тој ден се пополнува сам.",
        guide: [
          "Кога парите ќе стигнат на сметката, евидентирајте ги на фактурата: денот кога стигнале, колку е одобрено и провизиите што ги зела банката или платформата.",
          "Средниот курс на Народната банка за тој ден се пополнува сам, како што пресметува и УЈП, а штом плаќањата ја покријат фактурата, таа е платена.",
          "Исплатите без фактура, од платформа како Upwork, се евидентираат на ист начин.",
        ],
      },
      {
        id: "tax",
        title: "Колку должите на УЈП",
        caption: "Секој месец, данокот на доходот што сами го пријавувате: е-ПДД до 10-ти, плаќање до 15-ти.",
        guide: [
          "Страницата Плаќања го прикажува секој месец: што стигнало, доходот и данокот на него.",
          "За доходот што сами го пријавувате, од клиенти од странство, данокот е 10%, намален за данокот веќе платен во странство.",
          "Поднесете ја пресметката (е-ПДД) до 10-ти во наредниот месец и платете до 15-ти; картичката на месецот ги покажува двата датума.",
        ],
      },
      {
        id: "withheld",
        title: "Данок задржан за вас",
        caption: "Фирма од Северна Македонија го задржува данокот од 10% и го плаќа за вас, па се гледа како веќе платен.",
        guide: [
          "Кога ве плаќа фирма од Северна Македонија, таа го задржува данокот од 10% и сама го уплатува во УЈП.",
          "Евидентирајте колку ви платила и колку данок задржала: месецот го прикажува тој данок како веќе платен за вас, па не се брои повторно во тоа што го должите.",
        ],
      },
      {
        id: "filing",
        title: "Поднесување до УЈП",
        caption: "Означете го месецот како поднесен, одобрен и платен, со броевите од УЈП.",
        guide: [
          "Откако ќе го поднесете е-ПДД на страницата на УЈП, означете го месецот како поднесен со бројот на пресметката.",
          "Кога УЈП ќе ја одобри, внесете го фолио бројот; откако ќе платите, означете го како платен.",
          "Секој чекор се гледа на месецот, а месец што пропуштил рок станува црвен.",
        ],
      },
      {
        id: "proof",
        title: "Докази и извоз",
        caption: "Прикачете го изводот од банката на плаќањето и извезете CSV за сметководителот.",
        guide: [
          "УЈП може да побара доказ за плаќање: прикачете му го изводот од банката, договорот или потврдата, како PDF или слика.",
          "Извезете ги плаќањата, фактурите или книжните одобренија за годината како CSV-датотеки што се отвораат во Excel, со заглавија на вашиот јазик.",
        ],
      },
      {
        id: "dashboard",
        title: "Контролна табла",
        caption: "Колку должите и до кога, што стигнало и што уште ви должат клиентите.",
        guide: [
          "Контролната табла ги собира на едно место: колку должите на УЈП и наредниот рок, колку сте примиле оваа година и фактурите што клиентите уште ви ги должат.",
          "Покажува и колку е вашиот промет во Северна Македонија блиску до прагот за ДДВ од 2.000.000 денари.",
        ],
      },
      {
        id: "end",
        title: "Пробајте",
        caption: `Пробајте со примерни податоци на ${DEMO_SITE}.`,
        guide: [],
      },
    ],
  },
  sq: {
    tagline: "Klientët, faturat, pagesat dhe sa i detyrohesh UJP-së",
    chapters: [
      {
        id: "intro",
        title: "Freelancr",
        caption: "Klientët, faturat, pagesat dhe sa i detyrohesh UJP-së, në një vend.",
        guide: [],
      },
      {
        id: "profile",
        title: "Profili yt",
        caption: "Mënyra si je regjistruar vendos afatet e tua në UJP dhe nëse fatura mund të ketë TVSH.",
        guide: [
          "Fillo te Cilësimet. Zgjidh si je regjistruar për tatim: pa veprimtari të regjistruar (rasti i zakonshëm për të ardhura nga klientë jashtë vendit) ose i vetëpunësuar i regjistruar. Kjo vendos afatet në UJP dhe si llogaritet tatimi i çdo pagese.",
          "Shëno regjistrimin për TVSH vetëm nëse UJP të ka regjistruar për TVSH; përndryshe faturat nuk kanë TVSH. Shto bankën, IBAN-in dhe BIC/SWIFT që të shtypen në çdo faturë.",
        ],
      },
      {
        id: "clients",
        title: "Klientët",
        caption: "Klientë në vend dhe jashtë, kompani ose persona fizikë, secili me gjuhën e faturave të veta.",
        guide: [
          "Shto çdo klient një herë: kompani ose person fizik, shtetin, monedhën dhe të dhënat e kontaktit.",
          "Faturat janë në maqedonisht për klientët në Maqedoninë e Veriut dhe në anglisht për klientët jashtë vendit, përveç nëse zgjedh një gjuhë tjetër, edhe shqipen.",
          "Shteti i klientit vendos edhe si tatohen pagesat e tij: kompanitë në Maqedoninë e Veriut e mbajnë vetë tatimin 10%.",
        ],
      },
      {
        id: "invoice",
        title: "Fatura",
        caption: "Ruaje si draft, lëshoje që të marrë numrin dhe shkarko PDF-në në gjuhën e klientit.",
        guide: [
          "Krijo një faturë për një klient me artikujt dhe datën e furnizimit; kundërvlera në MKD është sipas kursit të Bankës Popullore për atë ditë.",
          "Deri sa ta lëshosh, është draft që mund ta ndryshosh. Me lëshimin merr numrin e radhës për vitin dhe kyçet.",
          "PDF-ja është në gjuhën e klientit dhe ka të dhënat që ligji kërkon në një faturë.",
        ],
      },
      {
        id: "payment",
        title: "Pagesa",
        caption: "Regjistro paratë që arritën; kursi i Bankës Popullore për atë ditë plotësohet vetë.",
        guide: [
          "Kur paratë arrijnë në llogari, regjistroji te fatura: ditën kur arritën, sa u kreditua dhe tarifat që mori banka ose platforma.",
          "Kursi mesatar i Bankës Popullore për atë ditë plotësohet vetë, ashtu siç e konverton UJP, dhe kur pagesat e mbulojnë faturën, ajo shfaqet e paguar.",
          "Pagesat pa faturë, nga një platformë si Upwork, regjistrohen njësoj.",
        ],
      },
      {
        id: "tax",
        title: "Sa i detyrohesh UJP-së",
        caption: "Çdo muaj, tatimi për të ardhurat që i deklaron vetë: е-ПДД deri më 10 dhe pagesa deri më 15.",
        guide: [
          "Faqja Pagesat tregon çdo muaj: çfarë arriti, të ardhurat dhe tatimin për to.",
          "Për të ardhurat që i deklaron vetë, nga klientë jashtë vendit, tatimi është 10%, minus tatimin e paguar tashmë jashtë vendit.",
          "Dorëzo llogaritjen (е-ПДД) deri më 10 të muajit pasues dhe paguaj deri më 15; karta e muajit i tregon të dyja datat.",
        ],
      },
      {
        id: "withheld",
        title: "Tatimi i mbajtur për ty",
        caption: "Një kompani në Maqedoninë e Veriut e mban tatimin 10% dhe e paguan për ty, ndaj shfaqet si i paguar tashmë.",
        guide: [
          "Kur të paguan një kompani në Maqedoninë e Veriut, ajo e mban tatimin 10% dhe ia paguan vetë UJP-së.",
          "Regjistro sa të pagoi dhe sa tatim mbajti: muaji e tregon atë tatim si të paguar tashmë për ty, që të mos numërohet sërish në atë që detyrohesh.",
        ],
      },
      {
        id: "filing",
        title: "Dorëzimi në UJP",
        caption: "Shëno muajin si të dorëzuar, të miratuar dhe të paguar, me numrat e UJP-së.",
        guide: [
          "Pasi ta dorëzosh е-ПДД në faqen e UJP-së, shëno muajin si të dorëzuar me numrin e llogaritjes.",
          "Kur UJP ta miratojë, shto numrin e folios; pasi të paguash, shënoje si të paguar.",
          "Çdo hap shihet te muaji, dhe muaji që kalon një afat bëhet i kuq.",
        ],
      },
      {
        id: "proof",
        title: "Dëshmi dhe eksporte",
        caption: "Bashkëngjit ekstraktin bankar te pagesa dhe eksporto CSV për kontabilistin.",
        guide: [
          "UJP mund të kërkojë dëshmi për një pagesë: bashkëngjit ekstraktin bankar, kontratën ose konfirmimin, si PDF ose imazh.",
          "Eksporto pagesat, faturat ose notat e kreditit të vitit si skedarë CSV që hapen në Excel, me titujt në gjuhën tënde.",
        ],
      },
      {
        id: "dashboard",
        title: "Paneli",
        caption: "Sa detyrohesh dhe deri kur, çfarë arriti dhe çfarë të detyrohen ende klientët.",
        guide: [
          "Paneli i bashkon: sa i detyrohesh UJP-së dhe afatin e radhës, sa ke marrë këtë vit dhe faturat që klientët ende t'i detyrohen.",
          "Tregon edhe sa afër është furnizimi yt në Maqedoninë e Veriut pragut të TVSH-së prej 2.000.000 denarësh.",
        ],
      },
      {
        id: "end",
        title: "Provoje",
        caption: `Provoje me të dhëna shembull në ${DEMO_SITE}.`,
        guide: [],
      },
    ],
  },
};
