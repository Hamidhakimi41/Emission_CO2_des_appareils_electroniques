import pandas as pd
import numpy as np

def clean_boavizta_final(input_file, output_file):
    print(f"Chargement : {input_file}...")
    try:
        df = pd.read_csv(input_file, sep=';')
    except FileNotFoundError:
        return "Fichier introuvable."
    
    #--- STATISTIQUES DE BASE ---
    
    print(f"\n{'='*10} STATISTIQUES AVANT NETTOYAGE {'='*10}")
    print(f"Colonnes : {len(df.columns)} et Lignes : {len(df)}")
    print("-" * 30)
    for col in df.columns:
        nulls = df[col].isnull().sum()
        if nulls > 0:
            print(f" {col} : {nulls} vides")
        else:
            print(f"{col} : complet")
        

    # --- 1. NETTOYAGE DES FORMATS ---
    # Conversion des nombres (virgule -> point) , on aurait pu prendre le fichier anglais directement
    numeric_cols = [
        'gwp_total', 'gwp_use_ratio', 'gwp_manufacturing_ratio', 
        'weight', 'screen_size', 'yearly_tec', 'lifetime',
        'gwp_transport_ratio', 'gwp_eol_ratio'
    ]
    for col in numeric_cols:
        if col in df.columns:
            df[col] = pd.to_numeric(df[col].astype(str).str.replace(',', '.', regex=False), errors='coerce')

    # Nettoyage texte
    if 'subcategory' in df.columns:
        df['subcategory'] = df['subcategory'].str.strip().str.title()

    # --- 2. SUPPRESSION DES COLONNES INUTILES ---
    # Liste étendue : Colonnes vides + Métadonnées inutiles pour la dataviz
    cols_to_drop = [
        # 1. Colonnes vides ou quasi-vides (Données techniques manquantes)
        'height', 'gwp_battery_ratio', 'gwp_hdd_ratio', 
        'gwp_electronics_ratio', 'gwp_ssd_ratio', 'gwp_othercomponents_ratio',
        'server_type', 'memory', 'number_cpu', 'hard_drive', 'comment',
        
        # 2. Métadonnées de gestion (Inutiles pour l'analyse d'impact)
        'added_date',       # Date d'ajout dans la base (pas date de fabrication)
        'add_method',       # API ou manuel
        'sources',          # Liens URL
        'sources_hash',     # ID technique
        'gwp_error_ratio',  # Marge d'erreur
        
     
    ]
    
    # Suppression sécurisée
    df = df.drop(columns=[c for c in cols_to_drop if c in df.columns], errors='ignore')

    # --- 3. IMPUTATION ---
    print("Imputation des données manquantes...")

    # A. Données Physiques : Médiane par Sous-Catégorie -> puis Catégorie
    cols_physical = ['lifetime', 'weight', 'yearly_tec', 'screen_size']
    for col in cols_physical:
        if col in df.columns:
            df[col] = df[col].fillna(df.groupby('subcategory')[col].transform('median'))
            df[col] = df[col].fillna(df.groupby('category')[col].transform('median'))

    # B. Ratios Mineurs : Médiane par Catégorie
    for col in ['gwp_transport_ratio', 'gwp_eol_ratio']:
        if col in df.columns:
            df[col] = df[col].fillna(df.groupby('category')[col].transform('median')).fillna(0)

    # C. Ratios Majeurs : Déduction Logique (Total = 1)
    if 'gwp_use_ratio' in df.columns and 'gwp_manufacturing_ratio' in df.columns:
        # Remplir Use si manquant
        df['gwp_use_ratio'] = df['gwp_use_ratio'].fillna(
            1.0 - (df['gwp_manufacturing_ratio'].fillna(0) + df['gwp_transport_ratio'].fillna(0) + df['gwp_eol_ratio'].fillna(0))
        )
        # Remplir Manufacturing si manquant
        df['gwp_manufacturing_ratio'] = df['gwp_manufacturing_ratio'].fillna(
            1.0 - (df['gwp_use_ratio'].fillna(0) + df['gwp_transport_ratio'].fillna(0) + df['gwp_eol_ratio'].fillna(0))
        )
        # Clip pour éviter les valeurs < 0 ou > 1
        for r in ['gwp_use_ratio', 'gwp_manufacturing_ratio', 'gwp_transport_ratio', 'gwp_eol_ratio']:
            if r in df.columns: df[r] = df[r].clip(0, 1)

    # --- 4. calcul des nouvelles colonnes utiles pour les visualisations ---
    print("Calcul des nouvelles colonnes...")

    # CORRECTION DATE : On retire "format='mixed'" pour laisser Pandas gérer
    if 'report_date' in df.columns:
        # On force la conversion. Les erreurs deviennent NaT.
        df['report_date_clean'] = pd.to_datetime(df['report_date'], errors='coerce', dayfirst=True)
        
        # On extrait l'année seulement si la date est valide
        df['report_year'] = df['report_date_clean'].dt.year
        
        # Remplir les années manquantes par la médiane des années (souvent autour de 2020-2022)
        median_year = df['report_year'].median()
        df['report_year'] = df['report_year'].fillna(median_year).astype(int)

    # Calcul kgCO2e
    if 'gwp_total' in df.columns:
        df['gwp_manufacturing_kg'] = df['gwp_total'] * df['gwp_manufacturing_ratio']
        df['gwp_use_kg'] = df['gwp_total'] * df['gwp_use_ratio']

    # --- 5. STATISTIQUES FINALES ---
    print(f"\n{'='*10} STATISTIQUES FINALES {'='*10}")
    print(f"Colonnes restantes : {len(df.columns)}")
    print("-" * 30)
    for col in df.columns:
        nulls = df[col].isnull().sum()
        if nulls > 0:
            print(f" {col} : {nulls} vides")
        else:
            print(f"{col} : complet")
    
    # --- 6. SAUVEGARDE ---
    df.to_csv(output_file, index=False, sep=';')
    print(f"\nFichier sauvegardé : {output_file}")

# --- EXECUTION ---
INPUT_CSV = r'c:\Users\hamid\Master 2 DS\ProjetDataViz\data_visualisation_grp10\data\boavizta-data-fr.csv'
OUTPUT_CSV = r'c:\Users\hamid\Master 2 DS\ProjetDataViz\data_visualisation_grp10\data\data_cleaned\boavizta_data_cleaned.csv'
clean_boavizta_final(INPUT_CSV, OUTPUT_CSV)


