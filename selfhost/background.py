"""Two manually curated generic facts; no live web search or novel commentary.

Sources inspected 2026-10-20. Cards contain paraphrased minimal facts, not page
text. Matching anchors show relevance candidates, not proof of authorial intent.
"""
CARDS = (
    {'id': 'charon-obol', 'title': '钱币与卡戎的渡资',
     'fact': '希腊神话中的卡戎是冥界渡者；奥波尔银币被视为付给他的渡资。',
     'publisher': '大都会艺术博物馆', 'source_title': 'Silver obol',
     'url': 'https://www.metmuseum.org/art/collection/search/848360',
     'reviewed_on': '2026-10-20', 'active': True,
     'groups': (('钱币', '硬币', '银币'), ('交出', '给了', '付给', '下坡', '石阶', '渡河'))},
    {'id': 'underworld-descent', 'title': '下行与越界的神话意象',
     'fact': '盖蒂博物馆介绍的希腊神话中，歌者俄耳甫斯曾下降到冥界。',
     'publisher': '盖蒂博物馆', 'source_title': 'Underworld: Imagining the Afterlife',
     'url': 'https://www.getty.edu/art/exhibitions/ancient_underworld/inner.html',
     'reviewed_on': '2026-10-20', 'active': True,
     'groups': (('下坡', '向下', '下降', '石阶'), ('钱币', '硬币', '冥界', '冥府', '死者'))},
)


def retrieve_background(selection):
    """Bounded conjunctive keyword retrieval on the selection only (max 2)."""
    result = []
    for card in CARDS:
        anchors = [next((term for term in group if term in selection), None) for group in card['groups']]
        if card['active'] and all(anchors):
            result.append({k: v for k, v in card.items() if k not in ('groups', 'active')} |
                          {'selection_anchors': list(dict.fromkeys(anchors)),
                           'use_boundary': '只作文学联想；不证明作者用典，不推断人物未来或结局。'})
    return result
