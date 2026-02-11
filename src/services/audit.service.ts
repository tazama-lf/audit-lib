import type { IAuditService } from '../utils/interfaces/audit';
import { OpenSearchService } from './opensearch.service';

export const AuditService = {
	getInstance(service?: string): IAuditService {
		switch (service) {
			case 'opensearch':
				return OpenSearchService.getInstance();
			default:
				return OpenSearchService.getInstance();
		}
	},
};
