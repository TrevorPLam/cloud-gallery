(Get-Content 'client/screens/SmartAlbumsScreen.tsx' -Raw) -replace 'keyExtractor\(\[type\]\) => type}', 'keyExtractor={([type]) => type}' | Set-Content 'client/screens/SmartAlbumsScreen.tsx'
