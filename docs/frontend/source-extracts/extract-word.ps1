$ErrorActionPreference = 'Stop'
Add-Type -AssemblyName System.IO.Compression.FileSystem
$workspacePath = (Resolve-Path (Join-Path $PSScriptRoot '../../..')).Path
$wordFiles = Get-ChildItem -LiteralPath (Join-Path $workspacePath 'docs/spec') -Filter '*.docx' -File
foreach ($wordFile in $wordFiles) {
  $archive = [System.IO.Compression.ZipFile]::OpenRead($wordFile.FullName)
  try {
    $reader = [System.IO.StreamReader]::new($archive.GetEntry('word/document.xml').Open())
    try { [xml]$xml = $reader.ReadToEnd() } finally { $reader.Dispose() }
    $ns = [System.Xml.XmlNamespaceManager]::new($xml.NameTable)
    $ns.AddNamespace('w', 'http://schemas.openxmlformats.org/wordprocessingml/2006/main')
    $ns.AddNamespace('a', 'http://schemas.openxmlformats.org/drawingml/2006/main')
    $lines = [System.Collections.Generic.List[string]]::new()
    $lines.Add('# Word extract: ' + $wordFile.Name)
    $lines.Add('')
    $paragraphIndex = 0
    $tableIndex = 0
    foreach ($block in $xml.SelectSingleNode('//w:body', $ns).ChildNodes) {
      if ($block.LocalName -eq 'p') {
        $paragraphIndex++
        $paragraphText = ($block.SelectNodes('.//w:t', $ns) | ForEach-Object { $_.InnerText }) -join ''
        if ($paragraphText) { $lines.Add(('P{0}: {1}' -f $paragraphIndex, $paragraphText)) }
        foreach ($drawing in $block.SelectNodes('.//a:blip', $ns)) {
          $lines.Add('[embedded image relationship: ' + $drawing.GetAttribute('embed', 'http://schemas.openxmlformats.org/officeDocument/2006/relationships') + ']')
        }
      } elseif ($block.LocalName -eq 'tbl') {
        $tableIndex++
        $lines.Add('')
        $lines.Add('## Table ' + $tableIndex)
        foreach ($row in $block.SelectNodes('./w:tr', $ns)) {
          $cells = foreach ($cell in $row.SelectNodes('./w:tc', $ns)) {
            ($cell.SelectNodes('.//w:p', $ns) | ForEach-Object { ($_.SelectNodes('.//w:t', $ns) | ForEach-Object { $_.InnerText }) -join '' }) -join ' / '
          }
          $lines.Add('| ' + ($cells -join ' | ') + ' |')
        }
        $lines.Add('')
      }
    }
    $lines.Add('')
    $lines.Add('## Embedded assets inventory')
    foreach ($entry in $archive.Entries | Where-Object { $_.FullName -like 'word/media/*' }) {
      $lines.Add(('- {0} ({1} bytes)' -f $entry.FullName, $entry.Length))
    }
    $relationsEntry = $archive.GetEntry('word/_rels/document.xml.rels')
    if ($relationsEntry) {
      $relationsReader = [System.IO.StreamReader]::new($relationsEntry.Open())
      try { [xml]$relationsXml = $relationsReader.ReadToEnd() } finally { $relationsReader.Dispose() }
      $lines.Add('')
      $lines.Add('## Image relationships')
      foreach ($rel in $relationsXml.Relationships.Relationship | Where-Object { $_.Type -like '*/image' }) {
        $lines.Add(('- {0} => {1}' -f $rel.Id, $rel.Target))
      }
    }
    [System.IO.File]::WriteAllLines((Join-Path $PSScriptRoot ($wordFile.BaseName + '.md')), $lines, [System.Text.UTF8Encoding]::new($false))
    Write-Output ($wordFile.Name + ': ' + $paragraphIndex + ' paragraphs, ' + $tableIndex + ' tables, ' + ($archive.Entries | Where-Object { $_.FullName -like 'word/media/*' }).Count + ' assets')
  } finally { $archive.Dispose() }
}
