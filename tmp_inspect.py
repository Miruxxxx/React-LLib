from pathlib import Path
text = Path(r'src/pages/AbiturPage.jsx').read_text(encoding='utf-8')
start = text.index('  const paginatedStudents')
end = text.index('\n  return (', start)
print(repr(text[start:end]))
