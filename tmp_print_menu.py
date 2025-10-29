from pathlib import Path
text = Path(r'src/pages/AbiturPage.jsx').read_text(encoding='utf-8')
start = text.index('                        <button\n                          type="button"\n                          className="student-card-menu-item"\n                          onClick={handleMenuHistory}\n                        >')
end = text.index('                        </button>', start) + len('                        </button>')
print(repr(text[start:end]))
