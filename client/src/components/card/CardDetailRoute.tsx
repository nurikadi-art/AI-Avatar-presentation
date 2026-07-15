import { useNavigate, useParams } from 'react-router';
import { CardDetail } from './CardDetail';

export function CardDetailRoute() {
  const { boardId = '', cardId = '' } = useParams();
  const navigate = useNavigate();
  if (!cardId) return null;
  return (
    <CardDetail
      key={cardId}
      boardId={boardId}
      cardId={cardId}
      onClose={() => navigate(`/b/${boardId}`)}
    />
  );
}
