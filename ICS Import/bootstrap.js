/*
 * ICS Import CLH - bootstrap.js
 * Thunderbird 60 / Lightning
 *
 * Architecture :
 *  - Extension restartless (bootstrap.js), pas de chrome/overlay.
 *  - Enregistre au démarrage un composant XPCOM implémentant
 *    nsICommandLineHandler dans la catégorie "command-line-handler".
 *  - Le préfixe "0-" force ce handler à s'exécuter AVANT le handler
 *    mail par défaut de Thunderbird (qui utilise un préfixe "m-" ou
 *    "b-" selon les versions) : les entrées de catégorie sont lues
 *    dans l'ordre alphabétique, et 0 < lettres en ASCII.
 *  - Si l'argument reçu est un .ics, on le répare si besoin, on le
 *    fait parser par le service ICS natif de Lightning
 *    (@mozilla.org/calendar/import;1?type=ics), puis on OUVRE la
 *    fenêtre d'édition d'événement Lightning (pré-remplie, calendrier
 *    cible déjà sélectionné) au lieu d'enregistrer directement :
 *    c'est l'utilisateur qui relit et clique lui-même sur
 *    "Enregistrer". On pose cmdLine.preventDefault = true pour
 *    empêcher Thunderbird d'ouvrir en parallèle un message avec le
 *    fichier en pièce jointe.
 *
 * Points à vérifier sur le poste cible (voir message d'accompagnement) :
 *  - le préfixe "0-icsimport" passe bien avant le handler mail natif ;
 *  - le contractID "@mozilla.org/calendar/import;1?type=ics" existe
 *    dans la version de Lightning installée ;
 *  - le topic "calendar-startup-done" est bien émis par Lightning au
 *    chargement (utilisé ici pour ne pas importer avant que les
 *    calendriers CalDAV soient chargés au démarrage à froid).
 */

var { classes: Cc, interfaces: Ci, utils: Cu, results: Cr, manager: Cm } = Components;

Cu.import("resource://gre/modules/Services.jsm");

const CLH_CONTRACTID = "@legacy-systemes.fr/ics-import-clh;1";
const CLH_CLASSID    = Components.ID("{8f4a6e2a-9c1a-4d2b-9a3f-7b2c6f0e1a11}");
const CLH_CATEGORY   = "0-icsimport";
const CLH_ENTRY      = "0-icsimport";

// ---------------------------------------------------------------------
// Réparation ICS
// ---------------------------------------------------------------------
// Corrige uniquement le cas :
//   DTSTART;VALUE=DATE:20260928T0900000000
// -> DTSTART:20260928T090000
// (un DTSTART/DTEND avec un paramètre VALUE=DATE mais qui contient
// quand même un "T<heure>" est par définition mal formé : VALUE=DATE
// implique une date pure, sans heure). On ne touche jamais aux lignes
// VALUE=DATE légitimes (journée entière, pas de "T"), ni aux lignes
// DTSTART/DTEND déjà correctes (DATE-TIME sans VALUE=DATE).
function repairIcs(text) {
  const lineRe = /^(DTSTART|DTEND)((?:;[^:;]+)*);VALUE=DATE((?:;[^:;]+)*):(\d{8})T(\d{6})\d*\s*$/i;
  let lines = text.split(/\r\n|\n|\r/);
  let fixedCount = 0;
  let out = lines.map(function (line) {
    let m = line.match(lineRe);
    if (!m) return line;
    fixedCount++;
    let prop = m[1];
    let paramsBefore = m[2] || "";
    let paramsAfter = m[3] || "";
    let date = m[4];
    let time = m[5];
    return prop + paramsBefore + paramsAfter + ":" + date + "T" + time;
  });
  return { text: out.join("\r\n"), fixedCount: fixedCount };
}

// ---------------------------------------------------------------------
// Utilitaires fichiers
// ---------------------------------------------------------------------
function readFileAsText(nsIFile) {
  let stream = Cc["@mozilla.org/network/file-input-stream;1"]
    .createInstance(Ci.nsIFileInputStream);
  stream.init(nsIFile, -1, 0, 0);
  let cstream = Cc["@mozilla.org/intl/converter-input-stream;1"]
    .createInstance(Ci.nsIConverterInputStream);
  cstream.init(stream, "UTF-8", 0, 0);
  let str = {};
  let result = "";
  while (cstream.readString(4096, str) !== 0) {
    result += str.value;
  }
  cstream.close();
  stream.close();
  return result;
}

function writeTempIcsFile(text) {
  let file = Cc["@mozilla.org/file/directory_service;1"]
    .getService(Ci.nsIProperties)
    .get("TmpD", Ci.nsIFile);
  file.append("ics-import-clh-" + Date.now() + ".ics");
  file.createUnique(Ci.nsIFile.NORMAL_FILE_TYPE, 0o600);

  let ostream = Cc["@mozilla.org/network/file-output-stream;1"]
    .createInstance(Ci.nsIFileOutputStream);
  ostream.init(file, 0x02 | 0x08 | 0x20, 0o600, 0); // write, create, truncate
  let converter = Cc["@mozilla.org/intl/scriptableunicodeconverter"]
    .createInstance(Ci.nsIScriptableUnicodeConverter);
  converter.charset = "UTF-8";
  let istream = converter.convertToInputStream(text);
  let bstream = Cc["@mozilla.org/network/buffered-output-stream;1"]
    .createInstance(Ci.nsIBufferedOutputStream);
  bstream.init(ostream, 4096);
  bstream.writeFrom(istream, istream.available());
  bstream.close();
  ostream.close();
  return file;
}

function showError(msg) {
  Cu.reportError("ICS Import CLH: " + msg);
  try {
    Services.prompt.alert(null, "Import ICS - Lightning", msg);
  } catch (e) {}
}

function showInfo(msg) {
  try {
    Services.prompt.alert(null, "Import ICS - Lightning", msg);
  } catch (e) {}
}

// ---------------------------------------------------------------------
// Choix du calendrier cible
// ---------------------------------------------------------------------
function pickTargetCalendar() {
  let calMgr = Cc["@mozilla.org/calendar/manager;1"]
    .getService(Ci.calICalendarManager);
  let all = calMgr.getCalendars({});
  let writable = all.filter(function (c) { return !c.readOnly; });

  if (writable.length === 0) return null;

  // 1) calendrier par défaut défini dans Lightning
  try {
    if (calMgr.defaultCalendar && !calMgr.defaultCalendar.readOnly) {
      return calMgr.defaultCalendar;
    }
  } catch (e) {}

  // 2) calendrier actuellement affiché/sélectionné dans une fenêtre ouverte
  try {
    let win = Services.wm.getMostRecentWindow("mail:3pane");
    if (win && win.currentView && typeof win.currentView === "function") {
      let view = win.currentView();
      if (view && view.selectedCalendars && view.selectedCalendars.length === 1) {
        let sel = view.selectedCalendars[0];
        if (sel && !sel.readOnly) return sel;
      }
    }
  } catch (e) {}

  // 3) un seul calendrier writable disponible -> pas d'ambiguïté
  if (writable.length === 1) return writable[0];

  // 4) sinon, boîte de dialogue de choix
  try {
    let names = writable.map(function (c) { return c.name + "  (" + c.type + ")"; });
    let selectedIndex = {};
    let ok = Services.prompt.select(
      null,
      "Import ICS - Lightning",
      "Calendrier de destination :",
      names.length,
      names,
      selectedIndex
    );
    if (ok) return writable[selectedIndex.value];
  } catch (e) {}

  return null;
}

// ---------------------------------------------------------------------
// Import effectif d'un fichier .ics
// ---------------------------------------------------------------------
function importIcsFile(nsIFile) {
  let raw;
  try {
    raw = readFileAsText(nsIFile);
  } catch (e) {
    showError("Impossible de lire le fichier : " + nsIFile.path + "\n" + e);
    return;
  }

  let repaired = repairIcs(raw);
  let tmpFile = null;
  let items = [];

  try {
    tmpFile = writeTempIcsFile(repaired.text);

    let importer = Cc["@mozilla.org/calendar/import;1?type=ics"]
      .getService(Ci.calIImporter);

    let inputStream = Cc["@mozilla.org/network/file-input-stream;1"]
      .createInstance(Ci.nsIFileInputStream);
    inputStream.init(tmpFile, -1, 0, 0);

    items = importer.importFromStream(inputStream, {}) || [];
    inputStream.close();
  } catch (e) {
    showError(
      "Échec du parsing ICS pour " + nsIFile.leafName + " :\n" + e +
      "\n\nErreur d'origine Thunderbird : 2147500037 correspond en général " +
      "à un DTSTART/DTEND VALUE=DATE combiné à une heure. " +
      (repaired.fixedCount
        ? (repaired.fixedCount + " ligne(s) corrigée(s) automatiquement, " +
           "mais le fichier réparé reste invalide pour une autre raison.")
        : "Aucune ligne n'a matché le motif de réparation connu.")
    );
    return;
  } finally {
    if (tmpFile) {
      try { tmpFile.remove(false); } catch (e) {}
    }
  }

  if (!items.length) {
    showError("Aucun événement importable trouvé dans " + nsIFile.leafName);
    return;
  }

  let calendar = pickTargetCalendar();
  if (!calendar) {
    showError("Aucun calendrier disponible en écriture dans Lightning.");
    return;
  }

  // On n'enregistre PAS directement l'item : on ouvre la vraie fenêtre
  // d'édition d'événement de Lightning, pré-remplie, calendrier cible
  // déjà sélectionné. L'utilisateur relit/ajuste et clique lui-même
  // sur "Enregistrer" (c'est alors le code natif du dialogue qui fait
  // le calendar.addItem()).
  items.forEach(function (item) {
    withMainWindow(function (win) {
      try {
        win.createEventWithDialog(calendar, null, null, null, item);
      } catch (e) {
        showError("Impossible d'ouvrir la fenêtre d'édition d'événement : " + e);
      }
    });
  });
}

// ---------------------------------------------------------------------
// Récupère une fenêtre Thunderbird portant la fonction Lightning
// createEventWithDialog (chargée via l'overlay calendar-item-editing.js
// dans mail:3pane). Si aucune fenêtre n'est encore ouverte (démarrage
// à froid depuis un double-clic), on force l'ouverture de la fenêtre
// principale plutôt que de reconstruire nous-mêmes l'appel bas niveau
// à openDialog() sur calendar-event-dialog.xul (les propriétés exactes
// de l'objet "args" attendu par ce dialogue changent selon la version
// exacte de Lightning ; réutiliser la fonction native de Lightning est
// beaucoup plus fiable).
function withMainWindow(callback) {
  let win = Services.wm.getMostRecentWindow("mail:3pane");
  if (win && typeof win.createEventWithDialog === "function") {
    callback(win);
    return;
  }

  try {
    let newWin = Services.ww.openWindow(
      null,
      "chrome://messenger/content/messenger.xul",
      "_blank",
      "chrome,dialog=no,all",
      null
    );
    newWin.addEventListener("load", function onLoad() {
      newWin.removeEventListener("load", onLoad);
      // Laisser Lightning terminer son overlay/init après le "load" du XUL.
      newWin.setTimeout(function () {
        if (typeof newWin.createEventWithDialog === "function") {
          callback(newWin);
        } else {
          showError(
            "La fenêtre principale de Thunderbird s'est ouverte, mais la " +
            "fonction Lightning createEventWithDialog est introuvable. " +
            "Vérifie que Lightning est bien activé."
          );
        }
      }, 500);
    });
  } catch (e) {
    showError("Impossible d'ouvrir la fenêtre principale de Thunderbird : " + e);
  }
}

// ---------------------------------------------------------------------
// Attente du chargement complet des calendriers au démarrage à froid
// ---------------------------------------------------------------------
function runWhenCalendarsReady(callback) {
  let calMgr;
  try {
    calMgr = Cc["@mozilla.org/calendar/manager;1"].getService(Ci.calICalendarManager);
  } catch (e) {
    // Lightning pas encore prêt du tout -> on retente via l'observateur / timeout
    calMgr = null;
  }

  if (calMgr && calMgr.getCalendars({}).length > 0) {
    callback();
    return;
  }

  let done = false;
  let obs = {
    observe: function (subject, topic, data) {
      if (done) return;
      done = true;
      try { Services.obs.removeObserver(obs, "calendar-startup-done"); } catch (e) {}
      callback();
    }
  };
  try {
    Services.obs.addObserver(obs, "calendar-startup-done", false);
  } catch (e) {}

  // Filet de sécurité si le topic n'est jamais émis (nom différent selon version)
  Cc["@mozilla.org/timer;1"].createInstance(Ci.nsITimer).initWithCallback(
    { notify: function () {
        if (done) return;
        done = true;
        try { Services.obs.removeObserver(obs, "calendar-startup-done"); } catch (e) {}
        callback();
      }
    },
    6000,
    Ci.nsITimer.TYPE_ONE_SHOT
  );
}

// ---------------------------------------------------------------------
// Composant XPCOM : nsICommandLineHandler + nsIFactory (objet singleton)
// ---------------------------------------------------------------------
var icsCLH = {
  classID: CLH_CLASSID,
  contractID: CLH_CONTRACTID,

  QueryInterface: function (iid) {
    if (iid.equals(Ci.nsICommandLineHandler) ||
        iid.equals(Ci.nsIFactory) ||
        iid.equals(Ci.nsISupports)) {
      return this;
    }
    throw Cr.NS_ERROR_NO_INTERFACE;
  },

  // nsIFactory
  createInstance: function (outer, iid) {
    if (outer) throw Cr.NS_ERROR_NO_AGGREGATION;
    return this.QueryInterface(iid);
  },
  lockFactory: function (lock) {},

  // nsICommandLineHandler
  handle: function (cmdLine) {
    let icsFiles = [];
    let indicesToRemove = [];
    try {
      let len = cmdLine.length;
      for (let i = 0; i < len; i++) {
        let arg = cmdLine.getArgument(i);
        if (!arg || !/\.ics$/i.test(arg)) continue;

        let file = null;
        try {
          file = Cc["@mozilla.org/file/local;1"].createInstance(Ci.nsIFile);
          file.initWithPath(arg);
        } catch (e) {
          try {
            let uri = cmdLine.resolveURI(arg);
            if (uri instanceof Ci.nsIFileURL) file = uri.file;
          } catch (e2) {}
        }

        if (file && file.exists()) {
          icsFiles.push(file);
          indicesToRemove.push(i);
        }
      }
    } catch (e) {
      Cu.reportError("ICS Import CLH: erreur lecture ligne de commande: " + e);
    }

    if (icsFiles.length === 0) return;

    // On retire l'argument .ics de la ligne de commande : c'est ça qui
    // empêche réellement le handler mail par défaut (compose + pièce
    // jointe) de le voir, quel que soit son propre respect ou non de
    // "preventDefault". On enlève en partant de l'index le plus haut
    // pour ne pas décaler les index restants pendant la boucle.
    for (let i = indicesToRemove.length - 1; i >= 0; i--) {
      try {
        cmdLine.removeArguments(indicesToRemove[i], indicesToRemove[i]);
      } catch (e) {
        Cu.reportError("ICS Import CLH: removeArguments a échoué: " + e);
      }
    }

    // Filet de sécurité en plus, au cas où un autre handler regarderait
    // quand même l'état preventDefault.
    cmdLine.preventDefault = true;

    runWhenCalendarsReady(function () {
      icsFiles.forEach(importIcsFile);
    });
  },

  helpInfo: "  -ics-import (interne) : importe un fichier .ics dans Lightning.\n"
};

// ---------------------------------------------------------------------
// Cycle de vie du bootstrap
// ---------------------------------------------------------------------
function startup(data, reason) {
  let registrar = Cm.QueryInterface(Ci.nsIComponentRegistrar);
  registrar.registerFactory(CLH_CLASSID, "ICS Import CLH", CLH_CONTRACTID, icsCLH);

  let catMan = Cc["@mozilla.org/categorymanager;1"].getService(Ci.nsICategoryManager);
  catMan.addCategoryEntry(
    "command-line-handler",
    CLH_ENTRY,
    CLH_CONTRACTID,
    false, // persist
    true   // replace
  );
}

function shutdown(data, reason) {
  // APP_SHUTDOWN = 2 (constante bootstrap standard) : pas la peine de
  // désenregistrer si Thunderbird ferme complètement.
  if (reason === 2 /* APP_SHUTDOWN */) return;

  try {
    let catMan = Cc["@mozilla.org/categorymanager;1"].getService(Ci.nsICategoryManager);
    catMan.deleteCategoryEntry("command-line-handler", CLH_ENTRY, false);
  } catch (e) {}

  try {
    let registrar = Cm.QueryInterface(Ci.nsIComponentRegistrar);
    registrar.unregisterFactory(CLH_CLASSID, icsCLH);
  } catch (e) {}
}

function install(data, reason) {}
function uninstall(data, reason) {}
