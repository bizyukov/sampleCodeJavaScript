<?php
class IssueDetails extends Controller{

	function action_index($params){
		
		$id = $params["id"];
		$project = $params["project"];

		$query = "SELECT *, 
					-- (SELECT name FROM exbtt_projects p WHERE id=$project) projectName,
					(SELECT u.username FROM exbtt_users u WHERE id=i.updatedBy) userName,
					(SELECT CONCAT(u.firstName, ' ', u.lastName) FROM exbtt_users u WHERE id=i.updatedBy) fullName,
					(SELECT startTime FROM exbtt_tracked t WHERE projectId=$project AND issueId=$id AND endTime IS NULL) startDate,
					(SELECT id FROM exbtt_tracked t WHERE projectId=$project AND issueId=$id AND endTime IS NULL) trackingId 
				FROM exbtt_issues i WHERE i.id = $id AND i.project = $project";

		$stmt = $this->DB->db->query($query);
		
		$files = scandir('uploads/'.$project.'/'.$id.'/', 1);
		array_splice($files, count($files)-2, count($files));
		$filesCollection = array();
		
		for($i = 0; $i< count($files); $i++){
			if(!$files[$i]) continue;
			$filesCollection[$i] = array(
					'url'=> 'http://'.$_SERVER['SERVER_NAME'].'/uploads/'.$project.'/'.$id.'/'.$files[$i],
					'name' => $files[$i],
					'size' => filesize('uploads/'.$project.'/'.$id.'/'.$files[$i])
			);
		}
		
		$model = $stmt->fetchAll(PDO::FETCH_ASSOC);
		$model[0]['files'] = $filesCollection;

		if(!$files){
			$files = [];
		}
		
		$response = array("status"=>1, "model"=>$model, "files"=>$files);
		return $response;
	}
}