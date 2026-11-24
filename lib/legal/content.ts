// The privacy policy and the terms, in each language. Plain data: the pages
// in app/(public)/privacy and app/(public)/terms render it. Every fact here
// has to stay true of the app: what's stored, who processes it, for how long.
// Change LEGAL_UPDATED whenever a text changes.

import type { Locale } from "@/lib/i18n/types";

export const LEGAL_CONTACT_EMAIL = "taulant1995@gmail.com";
// "YYYY-MM-DD"
export const LEGAL_UPDATED = "2026-11-24";

export type LegalSection = {
  heading: string;
  paragraphs?: string[];
  bullets?: string[];
};

export type LegalDocument = {
  title: string;
  // "Last updated: {date}"
  updated: string;
  intro: string;
  sections: LegalSection[];
};

const C = LEGAL_CONTACT_EMAIL;

export const PRIVACY: Record<Locale, LegalDocument> = {
  en: {
    title: "Privacy policy",
    updated: "Last updated: {date}",
    intro:
      "Freelancr keeps your invoices, payments and tax records. This page says what it stores, why, who else handles it, for how long, and what you can ask for.",
    sections: [
      {
        heading: "Who is responsible",
        paragraphs: [
          `Freelancr is run by Taulant Sela, Struga, North Macedonia, who is the controller of your personal data under the Law on Personal Data Protection. Write to ${C} about anything on this page.`,
        ],
      },
      {
        heading: "What Freelancr stores",
        bullets: [
          "Your account: name, email address, a hash of your password (never the password itself) and the language you use.",
          "Your business profile: business name, address, place of issue, signatory, tax number (EDB), VAT number, bank, account number, IBAN and BIC/SWIFT, how you're registered for tax and your monthly advance.",
          "What you enter: clients, invoices, payments, credit notes and the steps you mark for UJP.",
          "Files you attach: bank statements, contracts and confirmations, as PDF, PNG or JPEG.",
          "Email records: where and when an invoice was emailed, which deadline reminders went out, and for the daily sending limit only the type and time of each email sent.",
          "For abuse limits: a keyed hash of the IP address behind password-reset and sample-data requests, never the address itself.",
        ],
        paragraphs: [
          "Freelancr never asks for your personal ID number (ЕМБГ). There are no ads, no analytics and no tracking.",
        ],
      },
      {
        heading: "Your clients' details",
        paragraphs: [
          "When you enter a client who is a person (a name, address, email or tax number), you decide what to enter and why. Freelancr keeps and uses it only on your behalf, to make your invoices and records.",
        ],
      },
      {
        heading: "Why, and on what basis",
        bullets: [
          "To run your account and do what you ask of it: invoices, PDFs, payments, tax figures, exports and emails to your clients (performing our agreement with you).",
          "Password-reset emails and deadline reminders (performing our agreement; you can turn reminders off in Settings).",
          "Keeping the service safe: the abuse limits and the daily email limit (legitimate interest).",
        ],
      },
      {
        heading: "Who else handles it",
        bullets: [
          "Vercel Inc. (United States) runs the app and stores the encrypted backups.",
          "Neon (United States) hosts the database, on Amazon Web Services in the US.",
          "Resend (United States) sends Freelancr's emails.",
        ],
        paragraphs: [
          "Each of them processes the data only to provide its service, under its data processing terms. Their servers are in the United States, so your data is transferred outside North Macedonia. The National Bank's exchange-rate service is asked only for dates and currencies, never for anything about you. Your data is never sold or shared for marketing.",
        ],
      },
      {
        heading: "How long it's kept",
        bullets: [
          "Everything in your account: until you delete the account. Deleting it removes your data from the database at once, and from the encrypted backups within 14 days, when the last backup that holds it is deleted.",
          "Sample-data accounts (\"Try it with sample data\"): 24 hours.",
          "IP hashes: 1 day. The daily email log: 2 days.",
          "A password-reset link works for 60 minutes and only once.",
        ],
        paragraphs: [
          "The law may require you to keep invoices and tax records for years. That obligation is yours, so export what you need before you delete your account.",
        ],
      },
      {
        heading: "Cookies",
        paragraphs: [
          "Freelancr uses two cookies, both needed for the site to work: one keeps you signed in (for up to 30 days) and one remembers your language. There are no other cookies.",
        ],
      },
      {
        heading: "Security",
        paragraphs: [
          "Connections use HTTPS. Passwords are stored only as bcrypt hashes. Your files can be downloaded only from your own account. The nightly backups are encrypted (AES-256-GCM) before they're stored.",
        ],
      },
      {
        heading: "Your rights",
        bullets: [
          "Access and portability: download your payments as CSV on the Payments page, and your invoices and credit notes on the Invoices page, or write to us for a full copy.",
          "Correction: edit your details in Settings and your records where they are.",
          "Deletion: delete your account in Settings, or write to us.",
          "Restriction and objection: write to us.",
        ],
        paragraphs: [
          `Write to ${C}; we answer within 30 days. You can also complain to the Personal Data Protection Agency (Агенција за заштита на личните податоци, azlp.mk).`,
        ],
      },
      {
        heading: "Changes",
        paragraphs: [
          "If this policy changes, the new version is posted here with a new date. If a change affects what happens to data you already gave, you'll get an email first.",
        ],
      },
    ],
  },
  mk: {
    title: "Политика за приватност",
    updated: "Последна измена: {date}",
    intro:
      "Freelancr ги чува вашите фактури, уплати и даночни евиденции. Оваа страница кажува што се чува, зошто, кој друг ги обработува, колку долго и што можете да побарате.",
    sections: [
      {
        heading: "Кој е одговорен",
        paragraphs: [
          `Freelancr го води Таулант Села, Струга, Северна Македонија, кој е контролор на вашите лични податоци според Законот за заштита на личните податоци. За сè на оваа страница пишете на ${C}.`,
        ],
      },
      {
        heading: "Што чува Freelancr",
        bullets: [
          "Вашата сметка: име, е-пошта, хаш на лозинката (никогаш самата лозинка) и јазикот што го користите.",
          "Вашиот деловен профил: деловно име, адреса, место на издавање, потписник, ЕДБ, ДДВ број, банка, број на сметка, IBAN и BIC/SWIFT, како сте регистрирани за данок и вашата месечна аконтација.",
          "Она што го внесувате: клиенти, фактури, уплати, книжни одобренија и чекорите што ги означувате за УЈП.",
          "Датотеки што ги прикачувате: изводи, договори и потврди, како PDF, PNG или JPEG.",
          "Евиденција за е-пошта: каде и кога е испратена фактура, кои потсетници за рокови се испратени, а за дневното ограничување само видот и времето на секоја испратена порака.",
          "За ограничувања против злоупотреба: клучен хаш на IP-адресата од која се бара нова лозинка или пример-сметка, никогаш самата адреса.",
        ],
        paragraphs: [
          "Freelancr никогаш не го бара вашиот ЕМБГ. Нема реклами, нема аналитика и нема следење.",
        ],
      },
      {
        heading: "Податоците за вашите клиенти",
        paragraphs: [
          "Кога внесувате клиент што е физичко лице (име, адреса, е-пошта или даночен број), вие одлучувате што внесувате и зошто. Freelancr ги чува и користи само во ваше име, за вашите фактури и евиденции.",
        ],
      },
      {
        heading: "Зошто и врз која основа",
        bullets: [
          "За да работи вашата сметка и да го прави она што го барате: фактури, PDF, уплати, даночни пресметки, извози и е-пошта до вашите клиенти (извршување на договорот со вас).",
          "Пораки за нова лозинка и потсетници за рокови (извршување на договорот; потсетниците може да ги исклучите во Поставки).",
          "Безбедност на услугата: ограничувањата против злоупотреба и дневното ограничување на е-пошта (легитимен интерес).",
        ],
      },
      {
        heading: "Кој друг ги обработува",
        bullets: [
          "Vercel Inc. (САД) ја извршува апликацијата и ги чува шифрираните резервни копии.",
          "Neon (САД) ја хостира базата на податоци, на Amazon Web Services во САД.",
          "Resend (САД) ги испраќа пораките на Freelancr.",
        ],
        paragraphs: [
          "Секој од нив ги обработува податоците само за да ја даде својата услуга, според своите услови за обработка на податоци. Нивните сервери се во САД, па вашите податоци се пренесуваат надвор од Северна Македонија. Од услугата за курсеви на Народната банка се бараат само датуми и валути, никогаш ништо за вас. Вашите податоци никогаш не се продаваат ниту се даваат за маркетинг.",
        ],
      },
      {
        heading: "Колку долго се чуваат",
        bullets: [
          "Сè во вашата сметка: додека не ја избришете. Со бришењето податоците веднаш се отстрануваат од базата, а од шифрираните резервни копии во рок од 14 дена, кога ќе се избрише последната копија што ги содржи.",
          "Пример-сметки („Пробајте со примерни податоци“): 24 часа.",
          "IP-хашови: 1 ден. Дневната евиденција за е-пошта: 2 дена.",
          "Линкот за нова лозинка важи 60 минути и само еднаш.",
        ],
        paragraphs: [
          "Законот може да бара фактурите и даночните евиденции да ги чувате со години. Таа обврска е ваша, па извезете го она што ви треба пред да ја избришете сметката.",
        ],
      },
      {
        heading: "Колачиња",
        paragraphs: [
          "Freelancr користи две колачиња, двете неопходни за страницата да работи: едното ве држи најавени (до 30 дена), а другото го памети јазикот. Други колачиња нема.",
        ],
      },
      {
        heading: "Безбедност",
        paragraphs: [
          "Врските користат HTTPS. Лозинките се чуваат само како bcrypt хашови. Вашите датотеки може да се преземат само од вашата сметка. Ноќните резервни копии се шифрираат (AES-256-GCM) пред да се зачуваат.",
        ],
      },
      {
        heading: "Вашите права",
        bullets: [
          "Пристап и преносливост: преземете ги уплатите како CSV на страницата Плаќања, а фактурите и книжните одобренија на страницата Фактури, или пишете ни за целосна копија.",
          "Исправка: изменете ги податоците во Поставки, а евиденциите таму каде што се.",
          "Бришење: избришете ја сметката во Поставки, или пишете ни.",
          "Ограничување и приговор: пишете ни.",
        ],
        paragraphs: [
          `Пишете на ${C}; одговараме во рок од 30 дена. Може да поднесете и претставка до Агенцијата за заштита на личните податоци (azlp.mk).`,
        ],
      },
      {
        heading: "Измени",
        paragraphs: [
          "Ако оваа политика се измени, новата верзија се објавува тука со нов датум. Ако измената влијае на она што се случува со податоците што веќе ги дадовте, прво ќе добиете е-пошта.",
        ],
      },
    ],
  },
  sq: {
    title: "Politika e privatësisë",
    updated: "Ndryshimi i fundit: {date}",
    intro:
      "Freelancr ruan faturat, pagesat dhe të dhënat e tua tatimore. Kjo faqe tregon çfarë ruhet, pse, kush tjetër i përpunon, për sa kohë dhe çfarë mund të kërkosh.",
    sections: [
      {
        heading: "Kush është përgjegjës",
        paragraphs: [
          `Freelancr drejtohet nga Taulant Sela, Strugë, Maqedonia e Veriut, i cili është kontrollues i të dhënave të tua personale sipas Ligjit për mbrojtjen e të dhënave personale. Për çdo gjë në këtë faqe shkruaj në ${C}.`,
        ],
      },
      {
        heading: "Çfarë ruan Freelancr",
        bullets: [
          "Llogaria jote: emri, email-i, një hash i fjalëkalimit (kurrë vetë fjalëkalimi) dhe gjuha që përdor.",
          "Profili i biznesit tënd: emri i biznesit, adresa, vendi i lëshimit, nënshkruesi, numri tatimor (EDB), numri i TVSH-së, banka, numri i llogarisë, IBAN dhe BIC/SWIFT, si je regjistruar për tatim dhe akontacioni mujor.",
          "Çfarë fut: klientët, faturat, pagesat, notat e kreditit dhe hapat që shënon për DAP-in.",
          "Skedarët që bashkëngjit: ekstrakte bankare, kontrata dhe konfirmime, si PDF, PNG ose JPEG.",
          "Të dhëna për email-et: ku dhe kur u dërgua një faturë, cilat kujtesa për afate u dërguan, dhe për kufirin ditor vetëm lloji dhe koha e çdo email-i të dërguar.",
          "Për kufijtë kundër abuzimit: një hash me çelës i adresës IP nga e cila kërkohet fjalëkalim i ri ose llogari shembull, kurrë vetë adresa.",
        ],
        paragraphs: [
          "Freelancr nuk ta kërkon kurrë numrin personal (ЕМБГ). Nuk ka reklama, analitikë apo gjurmim.",
        ],
      },
      {
        heading: "Të dhënat e klientëve të tu",
        paragraphs: [
          "Kur fut një klient që është person fizik (emër, adresë, email ose numër tatimor), ti vendos çfarë fut dhe pse. Freelancr i ruan dhe i përdor vetëm në emrin tënd, për faturat dhe të dhënat e tua.",
        ],
      },
      {
        heading: "Pse dhe mbi çfarë baze",
        bullets: [
          "Që llogaria jote të funksionojë dhe të bëjë atë që kërkon: fatura, PDF, pagesa, llogaritje tatimore, eksporte dhe email-e për klientët e tu (përmbushja e marrëveshjes me ty).",
          "Email-et për fjalëkalim të ri dhe kujtesat për afate (përmbushja e marrëveshjes; kujtesat mund t'i fikësh te Cilësimet).",
          "Siguria e shërbimit: kufijtë kundër abuzimit dhe kufiri ditor i email-eve (interes legjitim).",
        ],
      },
      {
        heading: "Kush tjetër i përpunon",
        bullets: [
          "Vercel Inc. (SHBA) e ekzekuton aplikacionin dhe ruan kopjet rezervë të enkriptuara.",
          "Neon (SHBA) e mban bazën e të dhënave, në Amazon Web Services në SHBA.",
          "Resend (SHBA) dërgon email-et e Freelancr.",
        ],
        paragraphs: [
          "Secili prej tyre i përpunon të dhënat vetëm për të ofruar shërbimin e vet, sipas kushteve të veta për përpunimin e të dhënave. Serverët e tyre janë në SHBA, prandaj të dhënat e tua transferohen jashtë Maqedonisë së Veriut. Shërbimit të kurseve të Bankës Popullore i kërkohen vetëm data dhe monedha, kurrë asgjë për ty. Të dhënat e tua nuk shiten kurrë dhe nuk jepen për marketing.",
        ],
      },
      {
        heading: "Për sa kohë ruhen",
        bullets: [
          "Gjithçka në llogarinë tënde: derisa ta fshish llogarinë. Fshirja i heq të dhënat menjëherë nga baza, dhe nga kopjet rezervë të enkriptuara brenda 14 ditëve, kur fshihet kopja e fundit që i përmban.",
          "Llogaritë shembull (\"Provoje me të dhëna shembull\"): 24 orë.",
          "Hash-et e IP-ve: 1 ditë. Regjistri ditor i email-eve: 2 ditë.",
          "Lidhja për fjalëkalim të ri vlen 60 minuta dhe vetëm një herë.",
        ],
        paragraphs: [
          "Ligji mund të kërkojë që faturat dhe të dhënat tatimore t'i ruash për vite. Ky detyrim është i yti, prandaj eksporto atë që të nevojitet para se ta fshish llogarinë.",
        ],
      },
      {
        heading: "Cookies",
        paragraphs: [
          "Freelancr përdor dy cookies, të dyja të nevojshme që faqja të funksionojë: njëra të mban të kyçur (deri në 30 ditë) dhe tjetra mban mend gjuhën. Cookies të tjera nuk ka.",
        ],
      },
      {
        heading: "Siguria",
        paragraphs: [
          "Lidhjet përdorin HTTPS. Fjalëkalimet ruhen vetëm si hash-e bcrypt. Skedarët e tu mund të shkarkohen vetëm nga llogaria jote. Kopjet rezervë të natës enkriptohen (AES-256-GCM) para se të ruhen.",
        ],
      },
      {
        heading: "Të drejtat e tua",
        bullets: [
          "Qasja dhe bartshmëria: shkarko pagesat si CSV te faqja Pagesat, dhe faturat e notat e kreditit te faqja Faturat, ose na shkruaj për një kopje të plotë.",
          "Korrigjimi: ndrysho të dhënat te Cilësimet, dhe të dhënat e tjera aty ku janë.",
          "Fshirja: fshije llogarinë te Cilësimet, ose na shkruaj.",
          "Kufizimi dhe kundërshtimi: na shkruaj.",
        ],
        paragraphs: [
          `Shkruaj në ${C}; përgjigjemi brenda 30 ditëve. Mund të paraqesësh ankesë edhe te Agjencia për Mbrojtjen e të Dhënave Personale (azlp.mk).`,
        ],
      },
      {
        heading: "Ndryshimet",
        paragraphs: [
          "Nëse kjo politikë ndryshon, versioni i ri publikohet këtu me datë të re. Nëse ndryshimi prek atë që ndodh me të dhënat që ke dhënë tashmë, së pari do të marrësh një email.",
        ],
      },
    ],
  },
};

export const TERMS: Record<Locale, LegalDocument> = {
  en: {
    title: "Terms of use",
    updated: "Last updated: {date}",
    intro:
      "These terms apply when you use Freelancr. By creating an account you accept them. They're short; please read them, especially the part about tax.",
    sections: [
      {
        heading: "What Freelancr is",
        paragraphs: [
          "Freelancr is a record-keeping tool for freelancers in North Macedonia: clients, invoices, payments and the income tax that follows from them. It's run by Taulant Sela, Struga, North Macedonia. It's free while it's in beta.",
        ],
      },
      {
        heading: "It isn't tax advice",
        paragraphs: [
          "The tax, deadlines and DDV figures Freelancr shows are estimates worked out from what you enter and from the rules as the app understands them. They can be wrong, and laws change. UJP's approved calculation is the final figure, and you alone are responsible for your filings, deadlines and payments. Check anything important with an accountant or UJP.",
        ],
      },
      {
        heading: "Your account",
        bullets: [
          "You must be at least 18, and the details you give must be true.",
          "Keep your password to yourself; you're responsible for what's done in your account.",
          "You may enter only data you're allowed to use, including your clients' details.",
        ],
      },
      {
        heading: "Your data",
        paragraphs: [
          "What you enter stays yours. You can export it as CSV at any time and delete your account in Settings. The privacy policy says how it's handled.",
        ],
      },
      {
        heading: "Fair use",
        paragraphs: [
          "Don't use Freelancr for anything unlawful, such as false invoices, and don't try to break it, overload it, get into other accounts or copy it automatically.",
        ],
      },
      {
        heading: "Availability and changes",
        paragraphs: [
          "Freelancr is provided as it is, without a promise that it will always be available or free of errors. Features may change. If Freelancr ever shuts down, you'll get at least 30 days' notice by email so you can export your data.",
        ],
      },
      {
        heading: "Liability",
        paragraphs: [
          "As far as the law allows, Freelancr isn't liable for tax, interest, penalties or other losses that come from wrong figures, missed deadlines, lost data or downtime. Nothing here limits liability that the law doesn't allow to be limited, such as for intent or gross negligence.",
        ],
      },
      {
        heading: "Ending",
        paragraphs: [
          "You can stop using Freelancr and delete your account at any time. An account that breaks these terms may be suspended or closed.",
        ],
      },
      {
        heading: "Law",
        paragraphs: [
          "These terms are governed by the law of North Macedonia, and its courts decide any dispute.",
        ],
      },
      {
        heading: "Changes and contact",
        paragraphs: [
          `If these terms change, the new version is posted here with a new date; important changes are emailed first. Questions: ${C}.`,
        ],
      },
    ],
  },
  mk: {
    title: "Услови за користење",
    updated: "Последна измена: {date}",
    intro:
      "Овие услови важат кога го користите Freelancr. Со креирање сметка ги прифаќате. Кратки се; прочитајте ги, особено делот за данокот.",
    sections: [
      {
        heading: "Што е Freelancr",
        paragraphs: [
          "Freelancr е алатка за евиденција за фриленсери во Северна Македонија: клиенти, фактури, уплати и данокот на личен доход што произлегува од нив. Го води Таулант Села, Струга, Северна Македонија. Бесплатен е додека е во бета-фаза.",
        ],
      },
      {
        heading: "Ова не е даночен совет",
        paragraphs: [
          "Данокот, роковите и износите за ДДВ што ги покажува Freelancr се проценки пресметани од она што го внесувате и од правилата како што ги разбира апликацијата. Може да бидат погрешни, а законите се менуваат. Конечниот износ е одобрената пресметка на УЈП, и само вие сте одговорни за вашите пријави, рокови и плаќања. За сè што е важно проверете кај сметководител или во УЈП.",
        ],
      },
      {
        heading: "Вашата сметка",
        bullets: [
          "Мора да имате најмалку 18 години, а податоците што ги давате мора да се вистинити.",
          "Чувајте ја лозинката за себе; вие сте одговорни за она што се прави во вашата сметка.",
          "Може да внесувате само податоци што имате право да ги користите, вклучително и податоците за вашите клиенти.",
        ],
      },
      {
        heading: "Вашите податоци",
        paragraphs: [
          "Она што го внесувате останува ваше. Може да го извезете како CSV во секое време и да ја избришете сметката во Поставки. Политиката за приватност кажува како се постапува со него.",
        ],
      },
      {
        heading: "Чесно користење",
        paragraphs: [
          "Не користете го Freelancr за ништо незаконско, на пример лажни фактури, и не обидувајте се да го расипете, преоптоварите, да влезете во туѓи сметки или автоматски да го копирате.",
        ],
      },
      {
        heading: "Достапност и измени",
        paragraphs: [
          "Freelancr се дава таков каков што е, без ветување дека секогаш ќе биде достапен или без грешки. Функциите може да се менуваат. Ако Freelancr некогаш престане да работи, ќе добиете најмалку 30 дена претходно известување по е-пошта за да ги извезете податоците.",
        ],
      },
      {
        heading: "Одговорност",
        paragraphs: [
          "Колку што дозволува законот, Freelancr не одговара за данок, камата, казни или други загуби што произлегуваат од погрешни износи, пропуштени рокови, изгубени податоци или прекини. Ништо тука не ја ограничува одговорноста што законот не дозволува да се ограничи, на пример за намера или груба небрежност.",
        ],
      },
      {
        heading: "Престанок",
        paragraphs: [
          "Може да престанете да го користите Freelancr и да ја избришете сметката во секое време. Сметка што ги крши овие услови може да биде суспендирана или затворена.",
        ],
      },
      {
        heading: "Право",
        paragraphs: [
          "За овие услови важи правото на Северна Македонија, а за спорови одлучуваат нејзините судови.",
        ],
      },
      {
        heading: "Измени и контакт",
        paragraphs: [
          `Ако овие услови се изменат, новата верзија се објавува тука со нов датум; за важните измени прво ќе добиете е-пошта. Прашања: ${C}.`,
        ],
      },
    ],
  },
  sq: {
    title: "Kushtet e përdorimit",
    updated: "Ndryshimi i fundit: {date}",
    intro:
      "Këto kushte vlejnë kur përdor Freelancr. Duke krijuar llogari, i pranon ato. Janë të shkurtra; lexoji, sidomos pjesën për tatimin.",
    sections: [
      {
        heading: "Çfarë është Freelancr",
        paragraphs: [
          "Freelancr është një mjet për mbajtjen e të dhënave për freelancerët në Maqedoninë e Veriut: klientë, fatura, pagesa dhe tatimi mbi të ardhurat personale që del prej tyre. E drejton Taulant Sela, Strugë, Maqedonia e Veriut. Është falas sa është në fazën beta.",
        ],
      },
      {
        heading: "Kjo nuk është këshillë tatimore",
        paragraphs: [
          "Tatimi, afatet dhe shumat për TVSH që tregon Freelancr janë vlerësime të llogaritura nga ajo që fut dhe nga rregullat siç i kupton aplikacioni. Mund të jenë të gabuara, dhe ligjet ndryshojnë. Shuma përfundimtare është llogaritja e miratuar e DAP-it, dhe vetëm ti je përgjegjës për deklarimet, afatet dhe pagesat e tua. Për çdo gjë të rëndësishme kontrollo me një kontabilist ose me DAP-in.",
        ],
      },
      {
        heading: "Llogaria jote",
        bullets: [
          "Duhet të jesh të paktën 18 vjeç, dhe të dhënat që jep duhet të jenë të vërteta.",
          "Mbaje fjalëkalimin për vete; ti je përgjegjës për atë që bëhet në llogarinë tënde.",
          "Mund të fusësh vetëm të dhëna që ke të drejtë t'i përdorësh, përfshirë të dhënat e klientëve të tu.",
        ],
      },
      {
        heading: "Të dhënat e tua",
        paragraphs: [
          "Ajo që fut mbetet e jotja. Mund ta eksportosh si CSV në çdo kohë dhe ta fshish llogarinë te Cilësimet. Politika e privatësisë tregon si trajtohen.",
        ],
      },
      {
        heading: "Përdorimi i ndershëm",
        paragraphs: [
          "Mos e përdor Freelancr për asgjë të paligjshme, për shembull fatura të rreme, dhe mos u përpiq ta prishësh, ta mbingarkosh, të hysh në llogari të tjera ose ta kopjosh automatikisht.",
        ],
      },
      {
        heading: "Disponueshmëria dhe ndryshimet",
        paragraphs: [
          "Freelancr ofrohet ashtu siç është, pa premtim se do të jetë gjithmonë i disponueshëm ose pa gabime. Funksionet mund të ndryshojnë. Nëse Freelancr ndonjëherë mbyllet, do të marrësh të paktën 30 ditë njoftim me email që të eksportosh të dhënat.",
        ],
      },
      {
        heading: "Përgjegjësia",
        paragraphs: [
          "Për aq sa e lejon ligji, Freelancr nuk përgjigjet për tatim, kamatë, gjoba ose humbje të tjera që vijnë nga shuma të gabuara, afate të humbura, të dhëna të humbura ose ndërprerje. Asgjë këtu nuk e kufizon përgjegjësinë që ligji nuk lejon të kufizohet, për shembull për qëllim ose pakujdesi të rëndë.",
        ],
      },
      {
        heading: "Përfundimi",
        paragraphs: [
          "Mund ta ndalosh përdorimin e Freelancr dhe ta fshish llogarinë në çdo kohë. Një llogari që i shkel këto kushte mund të pezullohet ose të mbyllet.",
        ],
      },
      {
        heading: "E drejta",
        paragraphs: [
          "Për këto kushte vlen e drejta e Maqedonisë së Veriut, dhe për mosmarrëveshjet vendosin gjykatat e saj.",
        ],
      },
      {
        heading: "Ndryshimet dhe kontakti",
        paragraphs: [
          `Nëse këto kushte ndryshojnë, versioni i ri publikohet këtu me datë të re; për ndryshimet e rëndësishme së pari do të marrësh email. Pyetje: ${C}.`,
        ],
      },
    ],
  },
};
