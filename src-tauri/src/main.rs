// Prevents additional console window on Windows in release, DO NOT REMOVE!!
#![cfg_attr(not(debug_assertions), windows_subsystem = "windows")]

fn main() {
    // Вызываем функцию run() из твоего файла lib.rs
    minimal_browser_lib::run();
}
