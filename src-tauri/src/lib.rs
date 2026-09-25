// Le jeu est entièrement écrit en JavaScript ; Tauri ne fait qu'ouvrir une fenêtre native.
// La sauvegarde utilise le stockage local de la fenêtre, conservé entre deux lancements.
#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .run(tauri::generate_context!())
        .expect("erreur au lancement de Le Raider");
}
