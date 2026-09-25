// Point d'entrée de l'application de bureau : la fenêtre charge le jeu compilé par Vite (dossier dist).
#![cfg_attr(not(debug_assertions), windows_subsystem = "windows")]

fn main() {
    le_raider_lib::run()
}
